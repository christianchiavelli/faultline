import type { FeedWindow, RecentQuakesResponse } from '@shared/api/contracts';
import { diffFeeds, feedVersion } from '@shared/api/feed-change';
import { problem, type ApiResult } from '../http/result';
import { recentQuakes } from '../usgs/catalogue';
import { feedWindowOf } from './router';

/**
 * How often an open stream asks the feed cache for news. The cache decides
 * when the USGS is asked, once a minute at most, so this costs the USGS
 * nothing: it is how soon after the cache refreshes a reader hears of it.
 */
const CHECK_MS = 15_000;

/**
 * Written first, so the browser reconnects a dropped stream after this long.
 * A deploy drops every reader at once and they come back together, which the
 * cache answers with one load.
 */
const RECONNECT = 'retry: 5000\n\n';

/**
 * A comment, written on every check. A proxy closes a connection it has seen
 * nothing on for a minute (nginx's default), and a quiet feed says nothing for
 * longer than that.
 */
const HEARTBEAT = ':\n\n';

/** Where a reader's messages go: the transport writes them to its connection. */
export type StreamWrite = (chunk: string) => void;

export interface FeedStream {
  /**
   * Starts the reader's messages; the function it returns stops them, once the
   * connection closes. `end` closes the connection from this side, when the
   * server shuts down.
   */
  readonly subscribe: (write: StreamWrite, end: () => void) => () => void;
}

export interface FeedStreamOptions {
  /** Streams one client may hold open at once. */
  readonly perClient: number;
  readonly load?: (window: FeedWindow) => Promise<RecentQuakesResponse>;
  /** Calls `tick` every so often, until the function it returns is called. A spec ticks by hand. */
  readonly every?: (tick: () => void) => () => void;
}

interface Reader {
  readonly write: StreamWrite;
  readonly end: () => void;
  /** The version of the feed the reader holds, `null` while it holds none. */
  version: string | null;
}

interface Version {
  readonly feed: RecentQuakesResponse;
  readonly id: string;
  /** The whole feed as a message, built for the first reader who needs it and written to the rest. */
  whole?: string;
}

/**
 * The feeds as server-sent events (see `FeedChange` in `contracts.ts`). A hub
 * per window watches the feed cache for as long as anyone reads it, and brings
 * each reader to the latest version from the one they hold: what changed, when
 * they hold the version before it, or else the whole feed.
 *
 * In memory, like the rate limit: each instance streams what its own cache
 * holds, and counts its own readers.
 */
export function createFeedStreams(options: FeedStreamOptions) {
  const { perClient, load = recentQuakes, every = everyCheck } = options;
  const hubs = new Map<FeedWindow, Hub>();
  const held = new Map<string, number>();
  let closed = false;

  /**
   * `GET /api/quakes/recent/stream`. Refused before the first byte, with a
   * status to match: an unknown window is a 400, a client already holding its
   * share of streams a 429. After that it is open until the reader leaves.
   */
  function open(url: URL, client: string, lastEventId: string | null): ApiResult | FeedStream {
    const window = feedWindowOf(url);
    if (typeof window !== 'string') return window;
    if (closed) {
      const leaving = problem(503, 'Shutting down', 'Open the stream again in a few seconds.');
      return { ...leaving, headers: { ...leaving.headers, 'retry-after': '5' } };
    }

    // The rate limit only counts how fast streams are opened, and each one is held for hours.
    if ((held.get(client) ?? 0) >= perClient) {
      const limited = problem(
        429,
        'Too many open streams',
        `One address can follow the feed in ${perClient} tabs at once.`,
      );
      return { ...limited, headers: { ...limited.headers, 'retry-after': '60' } };
    }

    let hub = hubs.get(window);
    if (!hub) hubs.set(window, (hub = createHub(window, () => load(window), every)));
    const joined = hub;
    // A reconnect keeps the URL it was opened with, so the browser's own header is the newer word.
    const since = lastEventId ?? url.searchParams.get('since');

    return {
      subscribe(write, end) {
        held.set(client, (held.get(client) ?? 0) + 1);
        const leave = joined.join({ write, end, version: since });
        return () => {
          leave();
          const count = (held.get(client) ?? 1) - 1;
          if (count > 0) held.set(client, count);
          else held.delete(client);
        };
      },
    };
  }

  /**
   * Ends every stream, for a server shutting down, and refuses new ones. Each
   * browser opens its stream again after the wait the stream set, wherever
   * the address leads by then.
   */
  function close(): void {
    closed = true;
    for (const hub of hubs.values()) hub.close();
  }

  return { open, close };
}

export type FeedStreams = ReturnType<typeof createFeedStreams>;

type Hub = ReturnType<typeof createHub>;

function createHub(
  window: FeedWindow,
  load: () => Promise<RecentQuakesResponse>,
  every: (tick: () => void) => () => void,
) {
  const readers = new Set<Reader>();
  let latest: Version | null = null;
  let checking = false;
  let failing = false;
  let stop: (() => void) | undefined;

  /** One at a time: a USGS slow to answer must not pile checks up behind it. */
  async function check(): Promise<void> {
    if (checking) return;
    checking = true;
    try {
      const feed = await load();
      failing = false;
      const id = feedVersion(feed);
      const previous = latest;
      const next = previous?.id === id ? previous : { feed, id };
      latest = next;
      bringUp(previous, next);
    } catch (error) {
      // No copy at all, not even a stale one. Readers wait, and the next check tries again.
      if (!failing) console.warn(`[stream] ${window} feed unavailable`, error);
      failing = true;
    } finally {
      checking = false;
    }
  }

  function bringUp(previous: Version | null, next: Version): void {
    let change: string | undefined;
    for (const reader of readers) {
      if (reader.version === next.id) continue;
      reader.write(
        previous && reader.version === previous.id
          ? (change ??= message('change', next.id, diffFeeds(previous.feed, next.feed)))
          : (next.whole ??= message('feed', next.id, next.feed)),
      );
      reader.version = next.id;
    }
  }

  function join(reader: Reader): () => void {
    readers.add(reader);
    reader.write(RECONNECT);
    stop ??= every(() => {
      for (const each of readers) each.write(HEARTBEAT);
      void check();
    });
    // Now, not at the next tick: the reader may hold a copy older than the latest, or none.
    void check();

    return () => {
      readers.delete(reader);
      if (readers.size > 0) return;
      stop?.();
      stop = undefined;
    };
  }

  function close(): void {
    // Each reader leaves as its connection closes, so not from the set being read.
    for (const reader of [...readers]) reader.end();
  }

  return { join, close };
}

function everyCheck(tick: () => void): () => void {
  const timer = setInterval(tick, CHECK_MS);
  return () => clearInterval(timer);
}

/** One server-sent event. JSON holds no raw line break, so the data fits on its single `data:` line. */
function message(event: 'feed' | 'change', id: string, data: unknown): string {
  return `event: ${event}\nid: ${id}\ndata: ${JSON.stringify(data)}\n\n`;
}
