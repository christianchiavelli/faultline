import type { FeedWindow, QuakeDetailResponse, RecentQuakesResponse } from '@shared/api/contracts';
import { byTimeDescending, type QuakeSummary } from '@shared/domain/quake';
import { serverConfig } from '../config';
import { createSwrCache } from '../http/swr-cache';
import { getJson, UpstreamError } from '../http/upstream';
import { preferredProduct, toOriginQuality, toQuake, toSummary } from './map';
import { detailSchema, featureSchema, feedSchema } from './schema';

/** The USGS regenerates the summary feeds once a minute; asking more often returns the same file. */
const feedCache = createSwrCache<FeedSnapshot>({
  freshForMs: 60_000,
  staleForMs: 10 * 60_000,
  onBackgroundError: (key, error) => console.warn(`[usgs] feed ${key} refresh failed`, error),
});

const detailCache = createSwrCache<QuakeDetailResponse | EventGone>({
  freshForMs: 60_000,
  staleForMs: 10 * 60_000,
  maxEntries: 500,
  onBackgroundError: (key, error) => console.warn(`[usgs] event ${key} refresh failed`, error),
});

interface FeedSnapshot {
  readonly generatedAt: number;
  readonly skipped: number;
  readonly quakes: readonly QuakeSummary[];
}

export interface EventGone {
  readonly gone: 'not-found' | 'deleted';
}

const FEED_FILE: Record<FeedWindow, string> = {
  hour: 'all_hour',
  day: 'all_day',
  week: 'all_week',
};

export async function recentQuakes(window: FeedWindow): Promise<RecentQuakesResponse> {
  const { value, stale } = await feedCache.get(window, () => fetchFeed(window));
  return { window, stale, ...value };
}

async function fetchFeed(window: FeedWindow): Promise<FeedSnapshot> {
  const url = `${serverConfig.usgsBaseUrl}/earthquakes/feed/v1.0/summary/${FEED_FILE[window]}.geojson`;
  const response = await getJson(url);
  if (response.status !== 200)
    throw new UpstreamError(`USGS feed answered ${response.status}`, response.status);

  const feed = feedSchema.parse(response.body);
  const quakes: QuakeSummary[] = [];
  let skipped = 0;

  for (const raw of feed.features) {
    const parsed = featureSchema.safeParse(raw);
    const quake = parsed.success ? toQuake(parsed.data) : null;
    if (quake) quakes.push(toSummary(quake));
    else if (!parsed.success) skipped++;
  }

  if (skipped > 0) console.warn(`[usgs] ${window} feed: skipped ${skipped} malformed records`);

  return { generatedAt: feed.metadata.generated, skipped, quakes: quakes.sort(byTimeDescending) };
}

export async function quakeDetail(id: string): Promise<QuakeDetailResponse | EventGone> {
  const { value } = await detailCache.get(id, () => fetchDetail(id));
  return value;
}

async function fetchDetail(id: string): Promise<QuakeDetailResponse | EventGone> {
  const url = `${serverConfig.usgsBaseUrl}/fdsnws/event/1/query?eventid=${encodeURIComponent(id)}&format=geojson`;
  const response = await getJson(url);

  // The FDSN service answers 404 for ids it never had and 409 for events it has since deleted.
  if (response.status === 404 || response.status === 204) return { gone: 'not-found' };
  if (response.status === 409) return { gone: 'deleted' };
  if (response.status !== 200)
    throw new UpstreamError(`USGS event answered ${response.status}`, response.status);

  const detail = detailSchema.parse(response.body);
  const quake = toQuake(detail);
  if (!quake) return { gone: 'deleted' };

  return { quake, origin: toOriginQuality(preferredProduct(detail.properties.products['origin'])) };
}

export function isGone(value: QuakeDetailResponse | EventGone): value is EventGone {
  return 'gone' in value;
}
