import type { Quake } from '../domain/quake';

/** A plausible reviewed M4.8, overridable field by field. For specs only. */
export function aQuake(overrides: Partial<Quake> = {}): Quake {
  return {
    id: 'us7000test',
    time: Date.UTC(2026, 8, 29, 4, 16, 27),
    updated: Date.UTC(2026, 8, 29, 5, 0, 0),
    magnitude: { value: 4.8, type: 'mb' },
    place: 'South Sandwich Islands region',
    location: { latitude: -58.1, longitude: -25.4, depthKm: 35.1 },
    review: 'reviewed',
    kind: 'earthquake',
    network: 'us',
    felt: null,
    alert: null,
    significance: 354,
    url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000test',
    ...overrides,
  };
}
