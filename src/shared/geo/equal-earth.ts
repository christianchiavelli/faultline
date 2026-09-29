/**
 * Equal Earth projection (Šavrič, Patterson & Jenny, 2018).
 *
 * Equal-area, so a cluster of dots covers the share of the map that its region
 * covers of the planet. Mercator would inflate Alaska and the Aleutians, two of
 * the busiest regions in the feed, to several times their true size.
 *
 * Dependency-free and import-free on purpose: the basemap script runs it through
 * Node's type stripping and the app bundles it, so the coastlines and the dots
 * are drawn by the same formula.
 */

const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Longitude and latitude in degrees onto the unit plane, y pointing north. */
export function equalEarth(longitude: number, latitude: number): Point {
  const lambda = (longitude * Math.PI) / 180;
  const theta = Math.asin(M * Math.sin((latitude * Math.PI) / 180));
  const t2 = theta * theta;
  const t6 = t2 * t2 * t2;

  return {
    x:
      (2 * Math.sqrt(3) * lambda * Math.cos(theta)) /
      (3 * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))),
    y: theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)),
  };
}

const X_MAX = equalEarth(180, 0).x;
const Y_MAX = equalEarth(0, 90).y;

/** Map frame in SVG user units. The height keeps the projection's own aspect ratio. */
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = Math.round(((MAP_WIDTH * Y_MAX) / X_MAX) * 1000) / 1000;

/** Longitude and latitude in degrees onto the map frame, y pointing down. */
export function toMap(longitude: number, latitude: number): Point {
  const { x, y } = equalEarth(longitude, latitude);
  return {
    x: ((x + X_MAX) / (2 * X_MAX)) * MAP_WIDTH,
    y: ((Y_MAX - y) / (2 * Y_MAX)) * MAP_HEIGHT,
  };
}
