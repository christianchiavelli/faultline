import type { RecentQuakesResponse } from '@shared/api/contracts';
import { feedVersion } from '@shared/api/feed-change';
import { aQuake } from '@shared/testing/quake-fixture';
import { createFeedStreams, type FeedStreamOptions } from './feed-stream';

const NOW = Date.UTC(2026, 9, 1, 12);

const day: RecentQuakesResponse = {
  window: 'day',
  generatedAt: NOW,
  stale: false,
  skipped: 0,
  quakes: [aQuake({ id: 'us1tonga', time: NOW - 3_600_000 })],
};

/** A minute on, with one more event. */
const nextMinute: RecentQuakesResponse = {
  ...day,
  generatedAt: NOW + 60_000,
  quakes: [aQuake({ id: 'nc1fresh', time: NOW + 30_000 }), ...day.quakes],
};

const url = (query = '') => new URL(`http://localhost/api/quakes/recent/stream${query}`);

/** Lets a check's load resolve and its messages go out. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The messages a reader was sent, read back from the wire: event name, id and data. */
function messages(chunks: readonly string[]) {
  return chunks
    .join('')
    .split('\n\n')
    .filter((block) => block.startsWith('event:'))
    .map((block) => {
      const field = (name: string) =>
        block
          .split('\n')
          .find((line) => line.startsWith(`${name}: `))
          ?.slice(name.length + 2);
      return { event: field('event'), id: field('id'), data: JSON.parse(field('data')!) };
    });
}

function setUp(options: Partial<FeedStreamOptions> = {}) {
  let feed = day;
  const load = vi.fn(() => Promise.resolve(feed));
  const ticks = new Set<() => void>();
  const streams = createFeedStreams({
    perClient: 3,
    load,
    every: (tick) => {
      ticks.add(tick);
      return () => ticks.delete(tick);
    },
    ...options,
  });

  /** A reader on the day's stream, holding `since`; what it is written collects in `chunks`. */
  function read(since: string | null = null, client = '203.0.113.7') {
    const stream = streams.open(url('?window=day'), client, since);
    if (!('subscribe' in stream)) throw new Error(`Refused: ${stream.status}`);
    const chunks: string[] = [];
    const leave = stream.subscribe((chunk) => chunks.push(chunk));
    return { chunks, leave };
  }

  return {
    streams,
    load,
    read,
    ticks,
    moveOn: (next: RecentQuakesResponse) => (feed = next),
    tick: () => ticks.forEach((tick) => tick()),
  };
}

describe('createFeedStreams', () => {
  it('sends a reader who holds no copy the whole feed, after telling it how soon to reconnect', async () => {
    const { read } = setUp();

    const reader = read();
    await settle();

    expect(reader.chunks[0]).toBe('retry: 5000\n\n');
    expect(messages(reader.chunks)).toEqual([{ event: 'feed', id: feedVersion(day), data: day }]);
  });

  it('sends nothing to a reader who already holds the latest copy', async () => {
    const { read } = setUp();

    const reader = read(feedVersion(day));
    await settle();

    expect(messages(reader.chunks)).toEqual([]);
  });

  it('pushes only what changed to every reader, once the feed moves on', async () => {
    const { read, moveOn, tick } = setUp();
    const readers = [read(), read(feedVersion(day))];
    await settle();

    moveOn(nextMinute);
    tick();
    await settle();

    for (const reader of readers) {
      expect(messages(reader.chunks).at(-1)).toEqual({
        event: 'change',
        id: feedVersion(nextMinute),
        data: {
          generatedAt: NOW + 60_000,
          stale: false,
          skipped: 0,
          upserted: [nextMinute.quakes[0]],
          removed: [],
        },
      });
    }
  });

  it('sends the whole feed again to a reader whose copy it has moved past', async () => {
    const { read, moveOn, tick } = setUp();
    read();
    await settle();
    moveOn(nextMinute);
    tick();
    await settle();

    // Back from a hidden tab, holding the copy of a minute ago and more.
    const reader = read(`${NOW - 60_000}-f`);
    await settle();

    expect(messages(reader.chunks)).toEqual([
      { event: 'feed', id: feedVersion(nextMinute), data: nextMinute },
    ]);
  });

  it('takes the version from the reconnecting browser over the one in the address', async () => {
    const { streams } = setUp();
    const stream = streams.open(url('?since=0-f'), '203.0.113.7', feedVersion(day));
    if (!('subscribe' in stream)) throw new Error('Refused');
    const chunks: string[] = [];

    stream.subscribe((chunk) => chunks.push(chunk));
    await settle();

    expect(messages(chunks)).toEqual([]);
  });

  it('keeps a quiet stream open with a comment on every check', async () => {
    const { read, tick } = setUp();
    const reader = read(feedVersion(day));
    await settle();

    tick();
    await settle();

    expect(reader.chunks.slice(1)).toEqual([':\n\n']);
  });

  it('watches the feed only while someone reads it', async () => {
    const { read, ticks } = setUp();
    const first = read();
    const second = read();
    await settle();

    first.leave();
    expect(ticks.size).toBe(1);
    second.leave();

    expect(ticks.size).toBe(0);
  });

  it('asks the cache once for readers who arrive together', async () => {
    const { read, load } = setUp();

    read();
    read();
    read(feedVersion(day));
    await settle();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('holds a stream open through an outage, and sends the feed once there is one', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { read, load, tick } = setUp();
    load.mockRejectedValueOnce(new Error('USGS feed answered 503'));

    const reader = read();
    await settle();
    expect(messages(reader.chunks)).toEqual([]);

    tick();
    await settle();
    expect(messages(reader.chunks).map((message) => message.event)).toEqual(['feed']);
  });

  it('refuses a client past its share of streams until one of them closes', () => {
    const { streams, read } = setUp({ perClient: 2 });
    const first = read();
    read();

    expect(streams.open(url(), '203.0.113.7', null)).toMatchObject({ status: 429 });
    expect('subscribe' in streams.open(url(), '198.51.100.4', null)).toBe(true);
    first.leave();
    expect('subscribe' in streams.open(url(), '203.0.113.7', null)).toBe(true);
  });

  it('refuses a window there is no feed for', () => {
    const { streams } = setUp();

    expect(streams.open(url('?window=month'), '203.0.113.7', null)).toMatchObject({ status: 400 });
  });
});
