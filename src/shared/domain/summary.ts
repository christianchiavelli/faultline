import { radiatedEnergy } from './magnitude';
import { isEarthquake, isNotable, type QuakeSummary } from './quake';

export interface QuakeStats {
  readonly total: number;
  readonly earthquakes: number;
  /** Quarry blasts, explosions, ice quakes, landslides: seismic, but not earthquakes. */
  readonly otherEvents: number;
  readonly notable: number;
  /** Largest earthquake by magnitude. Other event kinds never qualify. */
  readonly largest: QuakeSummary | null;
  /**
   * Share of all earthquake energy radiated by `largest`, 0 to 1. Because
   * energy grows ~32x per magnitude step, this is usually most of the day.
   */
  readonly largestEnergyShare: number | null;
  /** Share of events a seismologist has reviewed, 0 to 1. */
  readonly reviewedShare: number | null;
}

export function summarise(quakes: readonly QuakeSummary[]): QuakeStats {
  let earthquakes = 0;
  let notable = 0;
  let reviewed = 0;
  let totalEnergy = 0;
  let largest: QuakeSummary | null = null;

  for (const quake of quakes) {
    if (quake.review === 'reviewed') reviewed++;
    if (!isEarthquake(quake)) continue;

    earthquakes++;
    if (isNotable(quake)) notable++;

    const magnitude = quake.magnitude?.value;
    if (magnitude === undefined) continue;

    totalEnergy += radiatedEnergy(magnitude);
    if (largest === null || magnitude > (largest.magnitude?.value ?? -Infinity)) largest = quake;
  }

  const largestMagnitude = largest?.magnitude?.value;

  return {
    total: quakes.length,
    earthquakes,
    otherEvents: quakes.length - earthquakes,
    notable,
    largest,
    largestEnergyShare:
      largestMagnitude === undefined || totalEnergy === 0
        ? null
        : radiatedEnergy(largestMagnitude) / totalEnergy,
    reviewedShare: quakes.length === 0 ? null : reviewed / quakes.length,
  };
}
