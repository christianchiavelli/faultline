import {
  EXPORT_COLUMNS,
  EXPORT_LIMIT,
  exportFileName,
  exportFormatSchema,
  exportQuerySchema,
  type ExportEvent,
  type ExportFormat,
  type ExportQuery,
} from '@shared/api/export';
import { csvLine } from '../formats/csv';
import { problem, type ApiResult } from '../http/result';
import { countEvents, searchEvents, type SearchPage } from '../usgs/search';
import { issuesDetail, upstreamProblem } from './problems';

export interface ExportFile {
  readonly fileName: string;
  readonly contentType: string;
  /**
   * The file, pulled by the transport as the USGS pages arrive. It throws when
   * the export cannot finish, and the transport must then cut the connection
   * rather than end the file: a partial export must never pass for a whole one.
   */
  readonly chunks: AsyncIterable<string>;
}

export interface ExportDependencies {
  readonly count: (query: ExportQuery) => Promise<number>;
  readonly search: (
    query: ExportQuery,
    options: { signal: AbortSignal },
  ) => AsyncIterable<SearchPage>;
}

const usgs: ExportDependencies = { count: countEvents, search: searchEvents };

/** An export holds a connection for as long as its pages take. Past this many at once, the next waits. */
const MAX_RUNNING = 4;
let running = 0;

/** Rows per write: small enough to stream, large enough not to be chatty. */
const CHUNK_ROWS = 1_000;

/**
 * `GET /api/quakes/export`. Everything that can be refused is refused before
 * the first byte, with a status to match: a bad query is a 400, a search too
 * large for one file a 422, a busy server a 503. After that the file streams.
 */
export async function prepareExport(
  url: URL,
  signal: AbortSignal,
  dependencies: ExportDependencies = usgs,
): Promise<ApiResult | ExportFile> {
  const params = Object.fromEntries(url.searchParams);
  const query = exportQuerySchema.safeParse(params);
  const format = exportFormatSchema.safeParse(params['format']);
  if (!query.success) return problem(400, 'Invalid export', issuesDetail(query.error));
  if (!format.success) return problem(400, 'Invalid export', 'Use format=csv or format=geojson.');

  if (running >= MAX_RUNNING) {
    const busy = problem(503, 'Too many exports right now', 'Try again in a few seconds.');
    return { ...busy, headers: { ...busy.headers, 'retry-after': '10' } };
  }

  let count: number;
  try {
    count = await dependencies.count(query.data);
  } catch (error) {
    return upstreamProblem(error, url.pathname);
  }

  // An export holds every match or does not happen: the first 100,000 of a
  // larger search would be an arbitrary slice presented as a whole.
  if (count > EXPORT_LIMIT) {
    return problem(
      422,
      'Too many events for one file',
      `This search matches ${count.toLocaleString('en')} events, and an export holds at most ${EXPORT_LIMIT.toLocaleString('en')}. Shorten the period or raise the smallest magnitude.`,
    );
  }

  return {
    fileName: exportFileName(query.data, format.data),
    contentType:
      format.data === 'csv' ? 'text/csv; charset=utf-8' : 'application/geo+json; charset=utf-8',
    chunks: track(write(dependencies.search(query.data, { signal }), query.data, format.data)),
  };
}

async function* track(chunks: AsyncIterable<string>): AsyncGenerator<string> {
  running++;
  try {
    yield* chunks;
  } finally {
    running--;
  }
}

function write(
  pages: AsyncIterable<SearchPage>,
  query: ExportQuery,
  format: ExportFormat,
): AsyncIterable<string> {
  return format === 'csv' ? writeCsv(pages) : writeGeoJson(pages, query);
}

async function* writeCsv(pages: AsyncIterable<SearchPage>): AsyncGenerator<string> {
  // A byte-order mark, or Excel reads the file as Latin-1 and "Pāhala" loses its macron.
  yield `\uFEFF${csvLine(EXPORT_COLUMNS)}`;
  for await (const page of pages) {
    for (const rows of chunked(page.events)) {
      yield rows.map((event) => csvLine(EXPORT_COLUMNS.map((column) => event[column]))).join('');
    }
  }
}

async function* writeGeoJson(
  pages: AsyncIterable<SearchPage>,
  query: ExportQuery,
): AsyncGenerator<string> {
  yield '{"type":"FeatureCollection","features":[\n';
  let written = 0;
  let skipped = 0;

  for await (const page of pages) {
    skipped += page.skipped;
    for (const rows of chunked(page.events)) {
      yield (written ? ',\n' : '') +
        rows.map((event) => JSON.stringify(toFeature(event))).join(',\n');
      written += rows.length;
    }
  }

  // Last, because only now are the totals known. GeoJSON allows foreign members.
  const metadata = {
    source: 'U.S. Geological Survey, via Faultline',
    from: new Date(query.from).toISOString(),
    to: new Date(query.to).toISOString(),
    count: written,
    skipped,
  };
  yield `\n],"metadata":${JSON.stringify(metadata)}}\n`;
}

/** The USGS's own GeoJSON layout: depth is the third coordinate, the rest are properties. */
function toFeature(event: ExportEvent) {
  const { latitude, longitude, depth, ...properties } = event;
  return {
    type: 'Feature',
    id: event.id,
    geometry: {
      type: 'Point',
      coordinates: depth === null ? [longitude, latitude] : [longitude, latitude, depth],
    },
    properties,
  };
}

function* chunked<T>(items: readonly T[]): Generator<readonly T[]> {
  for (let start = 0; start < items.length; start += CHUNK_ROWS) {
    yield items.slice(start, start + CHUNK_ROWS);
  }
}
