import { FEED_WINDOWS } from '@shared/api/contracts';
import { EXPORT_LIMIT, exportQuerySchema, type ExportCount } from '@shared/api/export';
import { z } from 'zod';
import { json, problem, withEtag, type ApiResult } from '../http/result';
import { isGone, quakeDetail, recentQuakes } from '../usgs/catalogue';
import { countEvents } from '../usgs/search';
import { issuesDetail, upstreamProblem } from './problems';

const windowSchema = z.enum(FEED_WINDOWS).default('day');

/** USGS ids are a network code and an event code, lowercase alphanumerics. */
const EVENT_PATH = /^\/api\/quakes\/([a-z0-9]{2,32})$/i;

export interface Catalogue {
  readonly recentQuakes: typeof recentQuakes;
  readonly quakeDetail: typeof quakeDetail;
  readonly countEvents: typeof countEvents;
}

const usgs: Catalogue = { recentQuakes, quakeDetail, countEvents };

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
    // Before the event path, which "count" would otherwise match as an id.
    if (url.pathname === '/api/quakes/count') return await count(catalogue, url);

    const event = EVENT_PATH.exec(url.pathname);
    if (event?.[1]) return await detail(catalogue, event[1].toLowerCase(), ifNoneMatch);

    return problem(404, 'No such endpoint');
  } catch (error) {
    return upstreamProblem(error, url.pathname);
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

/** How many events an export would hold, so the dialog can say so before anything downloads. */
async function count(catalogue: Catalogue, url: URL): Promise<ApiResult> {
  const query = exportQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) return problem(400, 'Invalid search', issuesDetail(query.error));

  const body: ExportCount = { count: await catalogue.countEvents(query.data), limit: EXPORT_LIMIT };
  return json(200, body, { 'cache-control': 'public, max-age=60' });
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
