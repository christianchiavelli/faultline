import type { ExportEvent, ExportQuery } from '@shared/api/export';
import { serverConfig } from '../config';
import { parseCsv } from '../formats/csv';
import { createSwrCache } from '../http/swr-cache';
import { getJson, getText, UpstreamError } from '../http/upstream';
import { spendOrRefuse, spendWhenAvailable } from './budget';
import { toExportEvent } from './map';
import { CSV_COLUMNS, countSchema, csvEventSchema } from './schema';

/**
 * Searches of the whole catalogue through the FDSN event service: how many
 * events match, and the events themselves, a page at a time. See
 * `docs/upstream-api.md` for how the service behaves.
 */

/** The most the USGS returns for one request. */
const PAGE_SIZE = 20_000;

/** Counts change as events arrive, but not from one keystroke to the next. */
const countCache = createSwrCache<number>({
  freshForMs: 60_000,
  staleForMs: 60_000,
  maxEntries: 500,
  onBackgroundError: (key, error) => console.warn(`[usgs] count ${key} failed`, error),
});

export async function countEvents(query: ExportQuery): Promise<number> {
  const params = searchParams(query, query.from);
  const { value } = await countCache.get(params.toString(), async () => {
    spendOrRefuse();
    params.set('format', 'geojson');
    // Wide counts are slow: M4.5 and up since 2000 took ten seconds.
    const response = await getJson(`${serverConfig.usgsBaseUrl}/fdsnws/event/1/count?${params}`, {
      timeoutMs: 30_000,
    });
    if (response.status !== 200)
      throw new UpstreamError(`USGS count answered ${response.status}`, response.status);
    return countSchema.parse(response.body).count;
  });
  return value;
}

export interface SearchPage {
  readonly events: readonly ExportEvent[];
  /** Rows dropped at the boundary because they failed validation. */
  readonly skipped: number;
}

export interface SearchOptions {
  readonly signal: AbortSignal;
  /** Injected in tests, which page through a handful of events. */
  readonly pageSize?: number;
  readonly fetchFn?: typeof fetch;
  readonly spend?: (signal: AbortSignal) => Promise<void>;
}

/**
 * Every event matching `query`, oldest first, one USGS page at a time.
 *
 * Pages are keyed by time, not by offset. Events keep landing in a window and
 * leaving it while it is being paged, as automatic solutions do, and each one
 * shifts every offset after it: offset paging would repeat an event or skip
 * one at every seam. Here each page starts at the time of the last event of
 * the page before, and the events already written at that instant are
 * dropped by id.
 */
export async function* searchEvents(
  query: ExportQuery,
  options: SearchOptions,
): AsyncGenerator<SearchPage> {
  const { signal, pageSize = PAGE_SIZE, fetchFn, spend = spendWhenAvailable } = options;
  let start = query.from;
  let written = new Set<string>();

  for (;;) {
    await spend(signal);

    const params = searchParams(query, start);
    params.set('orderby', 'time-asc');
    params.set('limit', String(pageSize));
    params.set('format', 'csv');
    const response = await getText(`${serverConfig.usgsBaseUrl}/fdsnws/event/1/query?${params}`, {
      signal,
      fetchFn,
      timeoutMs: 60_000,
    });

    // No match is the header alone in CSV, and a 204 in some other formats.
    if (response.status === 204) return;
    if (response.status !== 200)
      throw new UpstreamError(`USGS search answered ${response.status}`, response.status);

    const page = readPage(response.text, written);
    yield { events: page.events, skipped: page.skipped };

    if (page.rows < pageSize || !page.last) return;

    const last = Date.parse(page.last.time);
    if (last <= start) {
      throw new UpstreamError(`More than ${pageSize} events share the instant ${page.last.time}`);
    }
    written = page.last.ids;
    start = last;
  }
}

interface Page extends SearchPage {
  /** Data rows the USGS sent, valid or not: what decides whether another page follows. */
  readonly rows: number;
  /** The instant the page ends on, and the ids already written at it. */
  readonly last: { readonly time: string; readonly ids: Set<string> } | null;
}

function readPage(text: string, written: ReadonlySet<string>): Page {
  const [header, ...rows] = parseCsv(text);
  if (!header) return { events: [], skipped: 0, rows: 0, last: null };

  const missing = CSV_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length) {
    throw new UpstreamError(`The USGS search no longer sends ${missing.join(', ')}`);
  }

  const events: ExportEvent[] = [];
  let skipped = 0;
  let lastTime: string | null = null;
  let lastIds = new Set<string>();

  for (const cells of rows) {
    const record = Object.fromEntries(header.map((column, index) => [column, cells[index] ?? '']));
    const parsed = csvEventSchema.safeParse(record);
    if (!parsed.success) {
      skipped++;
      continue;
    }

    const event = toExportEvent(parsed.data);
    if (event.time !== lastTime) {
      lastTime = event.time;
      lastIds = new Set();
    }
    lastIds.add(event.id);
    if (!written.has(event.id)) events.push(event);
  }

  if (skipped > 0) console.warn(`[usgs] search page: skipped ${skipped} malformed rows`);
  return {
    events,
    skipped,
    rows: rows.length,
    last: lastTime ? { time: lastTime, ids: lastIds } : null,
  };
}

/** The query in the service's own terms. `to` is exclusive; `endtime` is not. */
function searchParams(query: ExportQuery, start: number): URLSearchParams {
  const params = new URLSearchParams({
    starttime: new Date(start).toISOString(),
    endtime: new Date(query.to - 1).toISOString(),
  });
  if (query.minMagnitude !== null) params.set('minmagnitude', String(query.minMagnitude));
  if (query.near) {
    params.set('latitude', String(query.near.latitude));
    params.set('longitude', String(query.near.longitude));
    params.set('maxradiuskm', String(query.near.radiusKm));
  }
  if (query.reviewedOnly) params.set('reviewstatus', 'reviewed');
  if (query.earthquakesOnly) params.set('eventtype', 'earthquake');
  return params;
}
