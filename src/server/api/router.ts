import { FEED_WINDOWS } from '@shared/api/contracts';
import { z } from 'zod';
import { UpstreamBusyError, UpstreamError } from '../http/upstream';
import { json, problem, withEtag, type ApiResult } from '../http/result';
import { isGone, quakeDetail, recentQuakes } from '../usgs/catalogue';

const windowSchema = z.enum(FEED_WINDOWS).default('day');

/** USGS ids are a network code and an event code, lowercase alphanumerics. */
const EVENT_PATH = /^\/api\/quakes\/([a-z0-9]{2,32})$/i;

export interface Catalogue {
  readonly recentQuakes: typeof recentQuakes;
  readonly quakeDetail: typeof quakeDetail;
}

const usgs: Catalogue = { recentQuakes, quakeDetail };

/**
 * Every `/api/*` request, whatever carried it. Transport-free so that the
 * Express adapter and the in-process SSR backend run the same code, and so a
 * test can call it with a fake catalogue and no server.
 */
export async function handleApiRequest(
  method: string,
  url: URL,
  ifNoneMatch: string | null = null,
  catalogue: Catalogue = usgs,
): Promise<ApiResult> {
  if (method !== 'GET' && method !== 'HEAD') {
    const notAllowed = problem(405, 'Method not allowed');
    return { ...notAllowed, headers: { ...notAllowed.headers, allow: 'GET, HEAD' } };
  }

  try {
    if (url.pathname === '/api/quakes/recent') return await recent(catalogue, url, ifNoneMatch);

    const event = EVENT_PATH.exec(url.pathname);
    if (event?.[1]) return await detail(catalogue, event[1].toLowerCase(), ifNoneMatch);

    return problem(404, 'No such endpoint');
  } catch (error) {
    if (error instanceof UpstreamBusyError) {
      const busy = problem(
        503,
        'Too many lookups right now',
        'This server is pacing its requests to the USGS. Try again in a few seconds.',
      );
      return {
        ...busy,
        headers: { ...busy.headers, 'retry-after': String(error.retryAfterSeconds) },
      };
    }
    if (error instanceof UpstreamError) {
      console.warn(`[api] ${url.pathname}: ${error.message}`);
      return problem(
        502,
        'The USGS did not answer',
        'Try again in a minute; the feed usually recovers on its own.',
      );
    }
    console.error(`[api] ${url.pathname}`, error);
    return problem(500, 'Something went wrong on our side');
  }
}

async function recent(
  catalogue: Catalogue,
  url: URL,
  ifNoneMatch: string | null,
): Promise<ApiResult> {
  const window = windowSchema.safeParse(url.searchParams.get('window') ?? undefined);
  if (!window.success) {
    return problem(400, 'Unknown feed window', `Use one of: ${FEED_WINDOWS.join(', ')}.`);
  }

  const feed = await catalogue.recentQuakes(window.data);
  return withEtag(
    json(200, feed, { 'cache-control': 'public, max-age=30, stale-while-revalidate=60' }),
    `feed-${feed.window}-${feed.generatedAt}-${feed.stale ? 's' : 'f'}`,
    ifNoneMatch,
  );
}

async function detail(
  catalogue: Catalogue,
  id: string,
  ifNoneMatch: string | null,
): Promise<ApiResult> {
  const result = await catalogue.quakeDetail(id);

  if (isGone(result)) {
    return result.gone === 'deleted'
      ? problem(
          410,
          'This event was deleted',
          'The USGS removed it from the catalogue, usually because it was a false detection or a duplicate.',
        )
      : problem(404, 'No such event', `The USGS catalogue has no event with id ${id}.`);
  }

  return withEtag(
    json(200, result, { 'cache-control': 'public, max-age=60, stale-while-revalidate=300' }),
    `quake-${result.quake.id}-${result.quake.updated}`,
    ifNoneMatch,
  );
}
