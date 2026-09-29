/**
 * A stand-in for earthquake.usgs.gov, so the end-to-end suite runs against a
 * known day instead of whatever the planet did today. Times are relative to
 * each request, so the events always fall inside the helicorder's 24 hours.
 *
 * The day is small but awkward on purpose, like the real feed: mixed
 * magnitude scales, automatic and reviewed events, a depth above sea level, a
 * place name outside ASCII, an explosion, an event with no magnitude yet and
 * one record that fails validation.
 *
 * Run by Playwright with plain `node`, which strips the types.
 */
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
const PORT = Number(process.env['PORT'] ?? 4310);

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
const ORIGINS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
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

function feature(event: StubEvent, now: number) {
  const time = Math.round(now - event.hoursAgo * HOUR);
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

function send(res: ServerResponse, status: number, body: unknown): void {
  const text = typeof body === 'string';
  res.writeHead(status, { 'content-type': text ? 'text/plain' : 'application/json' });
  res.end(text ? body : JSON.stringify(body));
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const now = Date.now();

  if (url.pathname === '/earthquakes/feed/v1.0/summary/all_day.geojson') {
    const features = [
      ...EVENTS.map((event) => feature(event, now)),
      { type: 'Feature', id: 'broken', properties: { mag: 2 }, geometry: null },
    ];
    return send(res, 200, {
      type: 'FeatureCollection',
      metadata: { generated: now, count: features.length },
      features,
    });
  }

  if (url.pathname === '/fdsnws/event/1/query') {
    const id = url.searchParams.get('eventid');
    if (id === 'zzgone') return send(res, 409, 'Error 409: Conflict');

    const event = EVENTS.find((candidate) => candidate.id === id);
    if (!event) return send(res, 404, 'Error 404: Not Found');

    const origin = ORIGINS[event.id];
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
