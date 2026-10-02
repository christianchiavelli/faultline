/**
 * A stand-in for earthquake.usgs.gov, so the end-to-end suite runs against a
 * known day instead of whatever the planet did today. Times are relative to
 * when the stub started, so the events fall inside the helicorder's 24 hours
 * for far longer than a run takes. Like a real event, each keeps its time from
 * one request to the next: only the feed's generation time moves on, so a page
 * following the feed mid-test is pushed nothing but that.
 *
 * The day is small but awkward on purpose, like the real feed: mixed
 * magnitude scales, automatic and reviewed events, a depth above sea level, a
 * place name outside ASCII, an explosion, an event with no magnitude yet and
 * one record that fails validation. A swarm of small ones at The Geysers, as
 * the real feed always has, makes the whole day longer than the log shows at
 * first.
 *
 * The same day answers searches, counted and as CSV, the way the FDSN event
 * service does. Before it the catalogue is far busier than the real one, and
 * only counted, never listed: enough to take a month past what one export
 * holds.
 *
 * For the Web Vitals, `STUB_DAY` names a day recorded off the real feed
 * instead (`scripts/record-day.ts`): a couple of hundred events, the size
 * a page's speed depends on, served the same way and just as still.
 *
 * Run by Playwright with plain `node`, which strips the types.
 */
import { readFileSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';

interface StubEvent {
  readonly id: string;
  readonly hoursAgo: number;
  readonly mag: number | null;
  readonly magType: string | null;
  readonly place: string;
  readonly status: 'automatic' | 'reviewed';
  readonly coordinates: readonly [number, number, number];
  readonly type?: string;
  readonly sig?: number;
  readonly alert?: string;
  readonly felt?: number;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const PORT = Number(process.env['PORT'] ?? 4310);
const STARTED = Date.now();

const EVENTS: readonly StubEvent[] = [
  {
    id: 'us7000big',
    hoursAgo: 5.2,
    mag: 6.2,
    magType: 'mww',
    place: 'south of the Fiji Islands',
    status: 'reviewed',
    coordinates: [-178.1, -24.3, 560.2],
    sig: 591,
    alert: 'green',
    felt: 12,
  },
  {
    id: 'us7000kerm',
    hoursAgo: 9.4,
    mag: 5.1,
    magType: 'mb',
    place: 'Kermadec Islands region',
    status: 'reviewed',
    coordinates: [-177.4, -30.1, 35],
  },
  {
    id: 'us7000tonga',
    hoursAgo: 15.1,
    mag: 4.6,
    magType: 'mb',
    place: '120 km NE of Neiafu, Tonga',
    status: 'automatic',
    coordinates: [-173.2, -17.8, 10],
  },
  {
    id: 'ak0001',
    hoursAgo: 2.1,
    mag: 3.4,
    magType: 'ml',
    place: '12 km NW of Anchorage, Alaska',
    status: 'reviewed',
    coordinates: [-150.1, 61.3, 42.3],
  },
  {
    id: 'pr0001',
    hoursAgo: 1.3,
    mag: 2.8,
    magType: 'md',
    place: '8 km S of Guánica, Puerto Rico',
    status: 'automatic',
    coordinates: [-66.9, 17.9, 11],
  },
  {
    id: 'nc0001',
    hoursAgo: 0.5,
    mag: 1.3,
    magType: 'md',
    place: '2 km NNW of The Geysers, CA',
    status: 'automatic',
    coordinates: [-122.76, 38.79, 0.75],
  },
  {
    id: 'hv0001',
    hoursAgo: 3.7,
    mag: 2.6,
    magType: 'ml',
    place: '6 km SW of Pāhala, Hawaii',
    status: 'reviewed',
    coordinates: [-155.52, 19.16, -1.2],
  },
  {
    id: 'uw0001',
    hoursAgo: 6.6,
    mag: 1.9,
    magType: 'md',
    place: '10 km S of Morton, Washington',
    status: 'reviewed',
    coordinates: [-122.3, 46.4, 0],
    type: 'explosion',
  },
  {
    id: 'nc0002',
    hoursAgo: 0.9,
    mag: 0.9,
    magType: 'md',
    place: '1 km NW of The Geysers, CA',
    status: 'automatic',
    coordinates: [-122.77, 38.8, 1.9],
  },
  {
    id: 'nc0003',
    hoursAgo: 2.8,
    mag: 1.6,
    magType: 'md',
    place: '3 km W of Cobb, CA',
    status: 'automatic',
    coordinates: [-122.76, 38.82, 2.4],
  },
  {
    id: 'nc0004',
    hoursAgo: 4.4,
    mag: 0.6,
    magType: 'md',
    place: '4 km NW of The Geysers, CA',
    status: 'automatic',
    coordinates: [-122.79, 38.81, 1.1],
  },
  {
    id: 'nc0005',
    hoursAgo: 7.9,
    mag: 1.2,
    magType: 'md',
    place: '6 km NW of Cobb, CA',
    status: 'reviewed',
    coordinates: [-122.78, 38.86, 3],
  },
  {
    id: 'nc0006',
    hoursAgo: 13.3,
    mag: 2.1,
    magType: 'md',
    place: '2 km E of The Geysers, CA',
    status: 'reviewed',
    coordinates: [-122.73, 38.78, 1.5],
  },
  {
    id: 'ci0001',
    hoursAgo: 11.8,
    mag: null,
    magType: null,
    place: '5 km E of Ridgecrest, CA',
    status: 'automatic',
    coordinates: [-117.6, 35.6, 7.9],
  },
];

/** Origin products, as the FDSN service publishes them: every property a string. */
type Origins = Readonly<Record<string, Readonly<Record<string, string>>>>;

const ORIGINS: Origins = {
  us7000big: {
    'horizontal-error': '7.4',
    'vertical-error': '3.1',
    'num-stations-used': '112',
    'azimuthal-gap': '28',
    'depth-type': 'from location',
  },
  us7000tonga: {
    'horizontal-error': '12.8',
    'vertical-error': '1.9',
    'num-stations-used': '19',
    'azimuthal-gap': '212',
    'depth-type': 'operator assigned',
  },
};

interface Day {
  readonly events: readonly StubEvent[];
  readonly origins: Origins;
  /** A record that fails validation, as the real feed has now and then. */
  readonly broken: boolean;
}

const RECORDED = process.env['STUB_DAY'];
const SERVED: Day = RECORDED
  ? { ...(JSON.parse(readFileSync(RECORDED, 'utf8')) as Day), broken: false }
  : { events: EVENTS, origins: ORIGINS, broken: true };

const timeOf = (event: StubEvent, now: number) => Math.round(now - event.hoursAgo * HOUR);

function feature(event: StubEvent, now: number) {
  const time = timeOf(event, now);
  return {
    type: 'Feature',
    id: event.id,
    properties: {
      mag: event.mag,
      place: event.place,
      time,
      updated: time + 40 * 60_000,
      url: `https://earthquake.usgs.gov/earthquakes/eventpage/${event.id}`,
      felt: event.felt ?? null,
      alert: event.alert ?? null,
      status: event.status,
      tsunami: 0,
      sig: event.sig ?? 100,
      net: event.id.slice(0, 2),
      magType: event.magType,
      type: event.type ?? 'earthquake',
    },
    geometry: { type: 'Point', coordinates: event.coordinates },
  };
}

/** Events a day before the known day, by the smallest magnitude asked for. */
const BACKGROUND_PER_DAY: readonly (readonly [floor: number, perDay: number])[] = [
  [6, 2],
  [4.5, 50],
  [2.5, 500],
  [-Infinity, 5_000],
];

interface Search {
  readonly start: number;
  /** Inclusive, as `endtime` is. */
  readonly end: number;
  readonly minMagnitude: number | null;
  readonly circle: {
    readonly latitude: number;
    readonly longitude: number;
    readonly km: number;
  } | null;
  readonly earthquakesOnly: boolean;
  /** `reviewed` or `automatic`, as `reviewstatus` takes them. */
  readonly review: string | null;
  readonly minDepth: number | null;
  readonly maxDepth: number | null;
}

function readSearch(params: URLSearchParams): Search {
  const number = (name: string) => (params.has(name) ? Number(params.get(name)) : null);
  const [latitude, longitude, km] = [
    number('latitude'),
    number('longitude'),
    number('maxradiuskm'),
  ];
  return {
    start: Date.parse(params.get('starttime') ?? ''),
    end: Date.parse(params.get('endtime') ?? ''),
    minMagnitude: number('minmagnitude'),
    circle:
      latitude !== null && longitude !== null && km !== null ? { latitude, longitude, km } : null,
    earthquakesOnly: params.get('eventtype') === 'earthquake',
    review: params.get('reviewstatus'),
    minDepth: number('mindepth'),
    maxDepth: number('maxdepth'),
  };
}

function matches(event: StubEvent, time: number, search: Search): boolean {
  const { minMagnitude, circle } = search;
  return (
    time >= search.start &&
    time <= search.end &&
    (minMagnitude === null || (event.mag !== null && event.mag >= minMagnitude)) &&
    (!search.review || event.status === search.review) &&
    (search.minDepth === null || event.coordinates[2] >= search.minDepth) &&
    (search.maxDepth === null || event.coordinates[2] <= search.maxDepth) &&
    (!search.earthquakesOnly || (event.type ?? 'earthquake') === 'earthquake') &&
    (!circle || distanceKm(event, circle) <= circle.km)
  );
}

/** Great-circle distance, on a sphere of the Earth's mean radius. */
function distanceKm(event: StubEvent, to: { latitude: number; longitude: number }): number {
  const [longitude, latitude] = event.coordinates;
  const rad = Math.PI / 180;
  const a =
    Math.sin(((to.latitude - latitude) * rad) / 2) ** 2 +
    Math.cos(latitude * rad) *
      Math.cos(to.latitude * rad) *
      Math.sin(((to.longitude - longitude) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

function listed(search: Search, now: number) {
  return SERVED.events
    .map((event) => ({ event, time: timeOf(event, now) }))
    .filter(({ event, time }) => matches(event, time, search))
    .sort((a, b) => a.time - b.time);
}

/** Spread over the whole world, too thin to land in any one circle. */
function background(search: Search, now: number): number {
  if (search.circle) return 0;
  const days = Math.max(0, Math.min(search.end, now - DAY) - search.start) / DAY;
  const floor = search.minMagnitude ?? -Infinity;
  const [, perDay] = BACKGROUND_PER_DAY.find(([from]) => floor >= from)!;
  return Math.round(days * perDay);
}

const CSV_HEADER =
  'time,latitude,longitude,depth,mag,magType,nst,gap,dmin,rms,net,id,updated,place,type,' +
  'horizontalError,depthError,magError,magNst,status,locationSource,magSource';

/** A row as the service writes one: the place always quoted, unknown values empty. */
function csvRow(event: StubEvent, time: number): string {
  const [longitude, latitude, depth] = event.coordinates;
  const net = event.id.slice(0, 2);
  const updated = new Date(time + 40 * 60_000).toISOString();
  return [
    new Date(time).toISOString(),
    latitude,
    longitude,
    depth,
    event.mag ?? '',
    event.magType ?? '',
    '',
    '',
    '',
    '',
    net,
    event.id,
    updated,
    `"${event.place}"`,
    event.type ?? 'earthquake',
    '',
    '',
    '',
    '',
    event.status,
    net,
    net,
  ].join(',');
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const text = typeof body === 'string';
  res.writeHead(status, { 'content-type': text ? 'text/plain' : 'application/json' });
  res.end(text ? body : JSON.stringify(body));
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const now = STARTED;

  if (url.pathname === '/earthquakes/feed/v1.0/summary/all_day.geojson') {
    const features = [
      ...SERVED.events.map((event) => feature(event, now)),
      ...(SERVED.broken
        ? [{ type: 'Feature', id: 'broken', properties: { mag: 2 }, geometry: null }]
        : []),
    ];
    return send(res, 200, {
      type: 'FeatureCollection',
      metadata: { generated: Date.now(), count: features.length },
      features,
    });
  }

  if (url.pathname === '/fdsnws/event/1/count') {
    const search = readSearch(url.searchParams);
    const count = listed(search, now).length + background(search, now);
    return send(res, 200, { count, maxAllowed: 20_000 });
  }

  if (url.pathname === '/fdsnws/event/1/query' && url.searchParams.get('format') === 'csv') {
    const limit = Number(url.searchParams.get('limit') ?? 20_000);
    const rows = listed(readSearch(url.searchParams), now)
      .slice(0, limit)
      .map(({ event, time }) => csvRow(event, time));
    // No match is the header alone, as the service sends it.
    res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8' });
    return res.end([CSV_HEADER, ...rows].map((line) => `${line}\n`).join(''));
  }

  if (url.pathname === '/fdsnws/event/1/query') {
    const id = url.searchParams.get('eventid');
    if (id === 'zzgone') return send(res, 409, 'Error 409: Conflict');

    const event = SERVED.events.find((candidate) => candidate.id === id);
    if (!event) return send(res, 404, 'Error 404: Not Found');

    const origin = SERVED.origins[event.id];
    const detail = feature(event, now);
    return send(res, 200, {
      ...detail,
      properties: {
        ...detail.properties,
        products: origin
          ? { origin: [{ source: 'us', preferredWeight: 158, properties: origin }] }
          : {},
      },
    });
  }

  send(res, 404, 'Not found');
}).listen(PORT, () => console.log(`USGS stub on http://localhost:${PORT}`));
