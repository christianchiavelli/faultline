import type { Quake, QuakeSummary } from '../domain/quake';

/**
 * The contract between the BFF and the app. The browser never sees the USGS
 * shapes, and these types are the only thing both sides import.
 */

export const FEED_WINDOWS = ['hour', 'day', 'week'] as const;
export type FeedWindow = (typeof FEED_WINDOWS)[number];

export interface RecentQuakesResponse {
  readonly window: FeedWindow;
  /** When the USGS generated the feed, epoch milliseconds. It regenerates every minute. */
  readonly generatedAt: number;
  /**
   * `true` when the BFF could not reach the USGS and is serving the last copy
   * it had. `generatedAt` says how old that copy is.
   */
  readonly stale: boolean;
  /** Records dropped at the boundary because they failed validation. */
  readonly skipped: number;
  /** Newest first. The detail endpoint has the rest of each record. */
  readonly quakes: readonly QuakeSummary[];
}

export interface QuakeDetailResponse {
  readonly quake: Quake;
  /** Quality of the preferred origin solution, when the network published one. */
  readonly origin: OriginQuality | null;
}

/**
 * How well the event is located. A position without its error bars is a
 * guess presented as a fact: an automatic solution from sparse stations can be
 * tens of kilometres off, and the depth is often fixed rather than measured.
 */
export interface OriginQuality {
  readonly horizontalErrorKm: number | null;
  readonly depthErrorKm: number | null;
  readonly stationsUsed: number | null;
  /** Largest gap between stations as seen from the epicentre. Above ~180° the solution is poorly constrained. */
  readonly azimuthalGapDeg: number | null;
  /** How the depth was obtained, e.g. `from location` or `operator assigned`. */
  readonly depthType: string | null;
}

/** RFC 9457 problem details, the body of every error response. */
export interface Problem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
}
