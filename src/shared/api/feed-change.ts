import { byTimeDescending, type QuakeSummary } from '../domain/quake';
import type { FeedChange, RecentQuakesResponse } from './contracts';

/**
 * Which copy of a feed this is: when the USGS generated it, and whether the
 * BFF is serving it because the USGS stopped answering. A reader sees both, so
 * a feed that goes stale is a new version too, with the same events in it.
 */
export function feedVersion(feed: Pick<RecentQuakesResponse, 'generatedAt' | 'stale'>): string {
  return `${feed.generatedAt}-${feed.stale ? 's' : 'f'}`;
}

/** What `next` holds that `previous` did not, or holds differently, and what it no longer holds. */
export function diffFeeds(previous: RecentQuakesResponse, next: RecentQuakesResponse): FeedChange {
  const before = new Map(previous.quakes.map((quake) => [quake.id, quake]));
  const kept = new Set(next.quakes.map((quake) => quake.id));
  return {
    generatedAt: next.generatedAt,
    stale: next.stale,
    skipped: next.skipped,
    upserted: next.quakes.filter((quake) => !same(before.get(quake.id), quake)),
    removed: previous.quakes.filter((quake) => !kept.has(quake.id)).map((quake) => quake.id),
  };
}

/** `feed` brought up to date: given `diffFeeds(feed, next)`, it is `next`. */
export function applyFeedChange(
  feed: RecentQuakesResponse,
  change: FeedChange,
): RecentQuakesResponse {
  const replaced = new Set([...change.removed, ...change.upserted.map((quake) => quake.id)]);
  return {
    window: feed.window,
    generatedAt: change.generatedAt,
    stale: change.stale,
    skipped: change.skipped,
    quakes: [...feed.quakes.filter((quake) => !replaced.has(quake.id)), ...change.upserted].sort(
      byTimeDescending,
    ),
  };
}

/**
 * Both copies come out of one mapper on the BFF, their keys in one order, so
 * their JSON is equal exactly when they are; and a field the summary gains is
 * compared without anyone having to remember it here.
 */
function same(before: QuakeSummary | undefined, after: QuakeSummary): boolean {
  return before !== undefined && JSON.stringify(before) === JSON.stringify(after);
}
