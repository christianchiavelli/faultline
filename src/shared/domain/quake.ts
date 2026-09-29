/**
 * A seismic event as the USGS catalogue describes it, normalised once at the
 * BFF boundary. Nothing downstream reads the upstream GeoJSON.
 */
export interface Quake {
  /** USGS event id: network code plus event code, e.g. `us7000q1ab`. */
  readonly id: string;
  /** Origin time, epoch milliseconds, UTC. */
  readonly time: number;
  /** Last revision by any contributing network, epoch milliseconds. */
  readonly updated: number;
  /** `null` until a network has computed one, which happens for fresh events. */
  readonly magnitude: Magnitude | null;
  /** Human description such as "12 km SSE of Ridgecrest, CA". Not always present. */
  readonly place: string | null;
  readonly location: QuakeLocation;
  readonly review: ReviewStatus;
  /** `earthquake`, `quarry blast`, `explosion`, `ice quake`… The feed mixes them. */
  readonly kind: string;
  /** Contributing network, e.g. `us`, `ak`, `ci`. */
  readonly network: string;
  /** "Did You Feel It?" responses, `null` when nobody reported. */
  readonly felt: number | null;
  /** PAGER impact alert, only issued for events that may cause damage. */
  readonly alert: AlertLevel | null;
  /** USGS significance score: magnitude, felt reports and impact, roughly 0 to 1000+. */
  readonly significance: number;
  /** The event page on earthquake.usgs.gov. */
  readonly url: string;
}

export interface Magnitude {
  readonly value: number;
  /** Lowercase USGS code: `mww`, `mb`, `ml`, `md`… See `magnitude.ts`. */
  readonly type: string;
}

export interface QuakeLocation {
  readonly latitude: number;
  readonly longitude: number;
  /**
   * Kilometres below sea level. Negative means above it: a shallow event
   * under a mountain or a volcano is located relative to sea level, not to
   * the ground surface.
   */
  readonly depthKm: number | null;
}

/**
 * `automatic` events were located by software and may still move, change
 * magnitude or be deleted. `reviewed` ones have been checked by a seismologist.
 */
export type ReviewStatus = 'automatic' | 'reviewed';

export type AlertLevel = 'green' | 'yellow' | 'orange' | 'red';

export const EARTHQUAKE_KIND = 'earthquake';

export function isEarthquake(quake: Quake): boolean {
  return quake.kind === EARTHQUAKE_KIND;
}

/**
 * The threshold the USGS itself uses for its "significant" feeds and the one
 * most catalogues treat as the floor for events felt widely.
 */
export const NOTABLE_MAGNITUDE = 4.5;

export function isNotable(quake: Quake): boolean {
  return isEarthquake(quake) && (quake.magnitude?.value ?? -Infinity) >= NOTABLE_MAGNITUDE;
}

/** Newest first, the order a live log reads in. */
export function byTimeDescending(a: Quake, b: Quake): number {
  return b.time - a.time;
}
