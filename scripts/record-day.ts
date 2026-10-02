/**
 * Records the USGS's last 24 hours as the day the Web Vitals are measured on
 * (`e2e/vitals/day.json`), in the shape the USGS stub serves its own day:
 *
 *   pnpm vitals:day
 *
 * The stub's day is a few dozen events, chosen to be awkward; a real one is
 * a couple of hundred, and that is what a page's speed depends on: the bursts
 * the trace draws, the rows the log unfolds, the options its filters count.
 * Each event keeps how long before the recording it happened, so the stub
 * replays the day as if it had just been recorded. The day's largest
 * earthquake is the event page measured, with the origin the FDSN service
 * publishes for it.
 *
 * Recording a new day moves every number the baseline holds: accept the
 * next measurement with `pnpm vitals:accept`.
 */
import { writeFile } from 'node:fs/promises';

const USGS = 'https://earthquake.usgs.gov';
const HEADERS = {
  'user-agent': 'Faultline/0.1 (+https://github.com/christianchiavelli/faultline)',
};
const OUT = new URL('../e2e/vitals/day.json', import.meta.url);
const HOUR = 3_600_000;

/** What the stub reads off an origin product, every property a string as the service writes it. */
const ORIGIN_PROPERTIES = [
  'horizontal-error',
  'vertical-error',
  'num-stations-used',
  'azimuthal-gap',
  'depth-type',
];

interface Feature {
  readonly id: string;
  readonly properties: {
    readonly mag: number | null;
    readonly magType: string | null;
    readonly place: string | null;
    readonly time: number;
    readonly status: 'automatic' | 'reviewed';
    readonly type: string;
    readonly sig: number | null;
    readonly alert: string | null;
    readonly felt: number | null;
  };
  readonly geometry: { readonly coordinates: readonly [number, number, number] } | null;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${USGS}${path}`, { headers: HEADERS });
  if (!response.ok) throw new Error(`${path}: the USGS answered ${response.status}`);
  return (await response.json()) as T;
}

const feed = await get<{ metadata: { generated: number }; features: Feature[] }>(
  '/earthquakes/feed/v1.0/summary/all_day.geojson',
);
const recorded = feed.metadata.generated;

const events = feed.features
  .filter((feature) => feature.geometry && feature.properties.place)
  .map(({ id, properties, geometry }) => ({
    id,
    hoursAgo: Math.round(((recorded - properties.time) / HOUR) * 10_000) / 10_000,
    mag: properties.mag,
    magType: properties.magType,
    place: properties.place,
    status: properties.status,
    coordinates: geometry!.coordinates,
    type: properties.type,
    ...(properties.sig === null ? {} : { sig: properties.sig }),
    ...(properties.alert === null ? {} : { alert: properties.alert }),
    ...(properties.felt === null ? {} : { felt: properties.felt }),
  }));

const largest = events
  .filter((event) => event.type === 'earthquake' && event.mag !== null)
  .reduce((a, b) => (b.mag! > a.mag! ? b : a));
const detail = await get<{
  properties: { products: { origin?: { properties: Record<string, string> }[] } };
}>(`/fdsnws/event/1/query?eventid=${largest.id}&format=geojson`);
const origin = detail.properties.products.origin?.[0]?.properties ?? {};

// One event a line, so a new recording reads as a diff of events.
const json = [
  '{',
  `  "recorded": ${JSON.stringify(new Date(recorded).toISOString())},`,
  `  "largest": ${JSON.stringify(largest.id)},`,
  `  "origins": ${JSON.stringify({
    [largest.id]: Object.fromEntries(
      ORIGIN_PROPERTIES.filter((name) => name in origin).map((name) => [name, origin[name]]),
    ),
  })},`,
  '  "events": [',
  events.map((event) => `    ${JSON.stringify(event)}`).join(',\n'),
  '  ]',
  '}',
  '',
].join('\n');

await writeFile(OUT, json);
console.log(`Recorded ${events.length} events, the largest ${largest.id}, M${largest.mag}.`);
