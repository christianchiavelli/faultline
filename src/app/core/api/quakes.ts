import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { DestroyRef, PLATFORM_ID, effect, inject, type WritableResource } from '@angular/core';
import type {
  FeedChange,
  FeedWindow,
  QuakeDetailResponse,
  RecentQuakesResponse,
} from '@shared/api/contracts';
import { applyFeedChange, feedVersion } from '@shared/api/feed-change';

/**
 * Data access for the app. Each needs an injection context, like any
 * `httpResource`: call them from a field initializer.
 *
 * During SSR these requests never touch the network; see `in-process-backend.ts`.
 */

export function recentQuakesResource(window: () => FeedWindow) {
  return httpResource<RecentQuakesResponse>(() => ({
    url: '/api/quakes/recent',
    params: { window: window() },
  }));
}

/**
 * A feed kept current: the copy the page was rendered with, then each change
 * the BFF pushes as it happens (`/api/quakes/recent/stream`).
 *
 * Not an `rxResource` over the stream, though a stream is what it follows: a
 * stream resource cannot start from the server's copy. Without an `id` it
 * starts loading, so the page hydrates in its waiting shape; with one, it
 * starts resolved and never runs its stream. An `httpResource` starts from the
 * copy, and the stream writes into it.
 */
export function liveQuakesResource(window: FeedWindow) {
  const feed = recentQuakesResource(() => window);
  followFeed(feed, window);
  return feed;
}

export function quakeDetailResource(id: () => string) {
  return httpResource<QuakeDetailResponse>(() => `/api/quakes/${encodeURIComponent(id())}`);
}

/**
 * A stream refused outright, by the 429 of an address holding its share or a
 * proxy's 502 mid-deploy, is one the browser gives up on. It is opened again
 * after a minute, the feed's own pace.
 */
const REOPEN_MS = 60_000;

/**
 * Opens the feed's stream from the copy `feed` holds, so it is sent only what
 * changed since, and writes each change into it. It waits for that copy, or
 * for the failure to get one: opened while the copy is on its way, the stream
 * would send the whole feed a second time.
 *
 * Closed while the tab is hidden. A browser opens at most six connections to
 * one origin over HTTP/1.1, and a stream held by every tab in the background
 * would leave the seventh unable to load anything. Back in view, it opens
 * again from the copy it has, and hears only what it missed.
 */
function followFeed(
  feed: WritableResource<RecentQuakesResponse | undefined>,
  window: FeedWindow,
): void {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
  const document = inject(DOCUMENT);

  let source: EventSource | undefined;
  let reopen: ReturnType<typeof setTimeout> | undefined;
  const current = () => (feed.hasValue() ? feed.value() : undefined);

  const close = () => {
    clearTimeout(reopen);
    source?.close();
    source = undefined;
  };

  const open = () => {
    close();
    const copy = current();
    const params = new URLSearchParams(copy ? { window, since: feedVersion(copy) } : { window });

    const stream = new EventSource(`/api/quakes/recent/stream?${params}`);
    stream.addEventListener('feed', (event) =>
      feed.set(JSON.parse(event.data) as RecentQuakesResponse),
    );
    stream.addEventListener('change', (event) => {
      // A change is to the copy before it. Holding none, the reader was sent a whole feed instead.
      const before = current();
      if (before) feed.set(applyFeedChange(before, JSON.parse(event.data) as FeedChange));
    });
    stream.addEventListener('error', () => {
      // Still connecting: the browser tries again by itself, after the wait the stream set.
      if (stream.readyState !== EventSource.CLOSED) return;
      close();
      reopen = setTimeout(open, REOPEN_MS);
    });
    source = stream;
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') close();
    else if (!source) open();
  };

  const start = effect(() => {
    if (feed.status() === 'loading') return;
    start.destroy();
    if (document.visibilityState === 'visible') open();
    document.addEventListener('visibilitychange', onVisibilityChange);
  });

  inject(DestroyRef).onDestroy(() => {
    close();
    document.removeEventListener('visibilitychange', onVisibilityChange);
  });
}
