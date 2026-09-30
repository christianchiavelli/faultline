import type { Params } from '@angular/router';

/**
 * What the log shows, kept in the address bar rather than a store: a view can
 * be shared, bookmarked and undone with Back, and the server renders it as it
 * was asked for. Each parameter is named after what it sets and holds a word
 * or a number that reads on its own; a default is left out of the address.
 */
export interface LogQuery {
  /** `?mag=any` or `?mag=4.5`. */
  readonly magnitude: MagnitudeFloor;
  /** `?rows=all`: every event, not only the latest. */
  readonly unfolded: boolean;
}

/**
 * M2.5 by default: below it the log is mostly the dense micro-seismicity of a
 * few Californian and Alaskan networks, and the trace above already shows it.
 */
export const MAGNITUDE_FLOORS = [
  { value: 'any', label: 'All', min: null },
  { value: '2.5', label: 'M2.5+', min: 2.5 },
  { value: '4.5', label: 'M4.5+', min: 4.5 },
] as const;

export type MagnitudeFloor = (typeof MAGNITUDE_FLOORS)[number]['value'];

/** The query parameters, as the router binds them to the page. */
export interface LogParams {
  readonly mag?: string;
  readonly rows?: string;
}

export const DEFAULT_LOG_QUERY: LogQuery = { magnitude: '2.5', unfolded: false };

/** Anything the log does not know, it reads as its default. */
export function parseLogQuery(params: LogParams): LogQuery {
  return {
    magnitude:
      MAGNITUDE_FLOORS.find((floor) => floor.value === params.mag)?.value ??
      DEFAULT_LOG_QUERY.magnitude,
    unfolded: params.rows === 'all',
  };
}

/**
 * The address of a view, always written in the same order, so that one view
 * has one address.
 */
export function logParams(query: LogQuery): Params {
  const params: Params = {};
  if (query.magnitude !== DEFAULT_LOG_QUERY.magnitude) params['mag'] = query.magnitude;
  if (query.unfolded) params['rows'] = 'all';
  return params;
}

export function minimumMagnitude(floor: MagnitudeFloor): number | null {
  return MAGNITUDE_FLOORS.find((candidate) => candidate.value === floor)!.min;
}
