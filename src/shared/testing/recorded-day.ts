import day from '../../../e2e/vitals/day.json';
import { byTimeDescending, type QuakeSummary, type ReviewStatus } from '../domain/quake';

/** An event as `pnpm vitals:day` records it, in the shape the USGS stub serves. */
interface RecordedEvent {
  readonly id: string;
  readonly hoursAgo: number;
  readonly mag: number;
  readonly magType: string;
  readonly place: string;
  readonly status: ReviewStatus;
  readonly coordinates: readonly [longitude: number, latitude: number, depthKm: number];
  readonly type: string;
}

const HOUR = 3_600_000;

/** When the day was recorded: the "now" of whatever draws it, so it draws alike every time. */
export const RECORDED_AT = Date.parse(day.recorded);

/** The id of the day's largest event, an M5.8 off Kamchatka. */
export const RECORDED_LARGEST = day.largest;

/**
 * A real day off the USGS, the one the Web Vitals are measured against
 * (`e2e/vitals/day.json`), held the way the app holds a feed: newest first.
 */
export const RECORDED_DAY: readonly QuakeSummary[] =
  // As `pnpm vitals:day` writes it: a JSON import types a position as `number[]`, not a triple.
  (day.events as unknown as readonly RecordedEvent[])
    .map((event) => ({
      id: event.id,
      time: Math.round(RECORDED_AT - event.hoursAgo * HOUR),
      magnitude: { value: event.mag, type: event.magType },
      place: event.place,
      location: {
        longitude: event.coordinates[0],
        latitude: event.coordinates[1],
        depthKm: event.coordinates[2],
      },
      review: event.status,
      kind: event.type,
    }))
    .sort(byTimeDescending);
