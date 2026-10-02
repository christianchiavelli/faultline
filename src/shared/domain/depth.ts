/**
 * Depth classes as seismology draws them. Shallow earthquakes, down to 70 km,
 * do most of the damage; intermediate ones reach 300 km; deep ones, down to
 * about 700, happen only where a plate dives into the mantle.
 */
export const DEPTH_CLASSES = [
  { value: 'shallow', fromKm: null, toKm: 70 },
  { value: 'intermediate', fromKm: 70, toKm: 300 },
  { value: 'deep', fromKm: 300, toKm: null },
] as const;

export type DepthClass = (typeof DEPTH_CLASSES)[number]['value'];

/** `null` for an event without a depth. An event above sea level is shallow. */
export function depthClassOf(depthKm: number | null): DepthClass | null {
  if (depthKm === null) return null;
  return DEPTH_CLASSES.find(({ toKm }) => toKm === null || depthKm < toKm)!.value;
}

export function isDepthClass(value: unknown): value is DepthClass {
  return DEPTH_CLASSES.some((depth) => depth.value === value);
}
