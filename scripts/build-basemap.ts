/**
 * Builds `public/maps/earth.svg`: coastlines, plate boundaries, graticule and
 * the outline of the globe, already projected to Equal Earth in the same frame
 * the app draws its dots in.
 *
 *   pnpm basemap
 *
 * Why a static file instead of a map library: the map shows where the day's
 * events happened, not a place to pan around, and a world at this scale is a
 * few dozen kilobytes of paths. The app references the groups with `<use>`, so
 * the file is cached once, never enters the JavaScript bundle, and inherits
 * the theme's colours through CSS.
 *
 * Sources
 * - Land: Natural Earth 1:110m, public domain. https://www.naturalearthdata.com
 * - Plate boundaries: Bird (2003), PB2002, as GeoJSON by Hugo Ahlenius, Nordpil.
 *   Open Data Commons Attribution License. https://github.com/fraxen/tectonicplates
 */
import { writeFile } from 'node:fs/promises';
import { MAP_HEIGHT, MAP_WIDTH, toMap } from '../src/shared/geo/equal-earth.ts';

// Pinned to a commit each, so the map is built from the same data whenever it is built.
// Natural Earth v5.1.2.
const LAND_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/f1890d9f152c896d250a77557a5751a93d494776/geojson/ne_110m_land.geojson';
// The last commit to change the boundaries, in 2014.
const PLATES_URL =
  'https://raw.githubusercontent.com/fraxen/tectonicplates/b53c3b7d82afd764650ebdc4565b9666795b9d83/GeoJSON/PB2002_boundaries.json';
const OUTPUT = new URL('../public/maps/earth.svg', import.meta.url);

type Position = [number, number];

interface Geometry {
  type: 'Polygon' | 'MultiPolygon' | 'LineString' | 'MultiLineString';
  coordinates: unknown;
}

interface FeatureCollection {
  features: { geometry: Geometry | null }[];
}

/** Points closer than this, in map units (the map is 1000 wide), add bytes and no detail. */
const MIN_STEP = 0.4;

function projectLine(line: readonly Position[]): Position[] {
  const projected: Position[] = [];
  for (const [longitude, latitude] of line) {
    const { x, y } = toMap(longitude, latitude);
    const last = projected.at(-1);
    if (last && Math.hypot(x - last[0], y - last[1]) < MIN_STEP) continue;
    projected.push([x, y]);
  }
  return projected;
}

/** Tenths of a unit, `0.6` as `.6`: the shortest form SVG accepts. */
function number(tenths: number): string {
  return String(tenths / 10).replace(/^(-?)0\./, '$1.');
}

/**
 * Relative commands on a grid of tenths. The deltas between neighbouring
 * vertices are a few tenths, so this is about a third of the size of absolute
 * coordinates, and rounding the absolute positions first means the relative
 * steps never drift.
 */
function pathOf(points: readonly Position[], closed: boolean): string {
  const grid = points.map(([x, y]) => [Math.round(x * 10), Math.round(y * 10)] as const);
  if (grid.length < 2) return '';

  const [[startX, startY]] = grid as [readonly [number, number]];
  let path = `M${number(startX)} ${number(startY)}l`;
  let [previousX, previousY] = [startX, startY];

  for (const [x, y] of grid.slice(1)) {
    if (x === previousX && y === previousY) continue;
    for (const value of [number(x - previousX), number(y - previousY)]) {
      path += path.endsWith('l') || value.startsWith('-') ? value : ` ${value}`;
    }
    [previousX, previousY] = [x, y];
  }

  return closed ? `${path}z` : path;
}

/**
 * A boundary that crosses the antimeridian arrives as one line jumping from
 * +179.9 to -179.9. Drawn as is, it becomes a stroke across the whole map, so
 * it is cut at the jump.
 */
function splitAtAntimeridian(line: readonly Position[]): Position[][] {
  const parts: Position[][] = [[]];
  line.forEach((point, index) => {
    const previous = line[index - 1];
    if (previous && Math.abs(point[0] - previous[0]) > 180) parts.push([]);
    parts.at(-1)!.push(point);
  });
  return parts;
}

async function fetchJson(url: string): Promise<FeatureCollection> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return (await response.json()) as FeatureCollection;
}

function land(collection: FeatureCollection): string {
  const polygons: Position[][][] = [];
  for (const { geometry } of collection.features) {
    if (geometry?.type === 'Polygon') polygons.push(geometry.coordinates as Position[][]);
    if (geometry?.type === 'MultiPolygon')
      polygons.push(...(geometry.coordinates as Position[][][]));
  }
  return polygons
    .flatMap((rings) => rings.map((ring) => pathOf(projectLine(ring), true)))
    .filter(Boolean)
    .join('');
}

function plates(collection: FeatureCollection): string {
  const lines: Position[][] = [];
  for (const { geometry } of collection.features) {
    if (geometry?.type === 'LineString') lines.push(geometry.coordinates as Position[]);
    if (geometry?.type === 'MultiLineString') lines.push(...(geometry.coordinates as Position[][]));
  }
  return lines
    .flatMap(splitAtAntimeridian)
    .map((line) => pathOf(projectLine(line), false))
    .filter(Boolean)
    .join('');
}

function range(from: number, to: number, step: number): number[] {
  return Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
}

function graticule(): string {
  const meridians = range(-150, 150, 30).map((longitude) =>
    range(-90, 90, 2).map((latitude): Position => [longitude, latitude]),
  );
  const parallels = range(-60, 60, 30).map((latitude) =>
    range(-180, 180, 2).map((longitude): Position => [longitude, latitude]),
  );
  return [...meridians, ...parallels].map((line) => pathOf(projectLine(line), false)).join('');
}

function sphere(): string {
  const west = range(-90, 90, 1).map((latitude): Position => [-180, latitude]);
  const east = range(-90, 90, 1).map((latitude): Position => [180, -latitude]);
  return pathOf(projectLine([...west, ...east]), true);
}

const [landCollection, plateCollection] = await Promise.all([
  fetchJson(LAND_URL),
  fetchJson(PLATES_URL),
]);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}">
<!-- Generated by scripts/build-basemap.ts. Land: Natural Earth (public domain). Plate boundaries: Bird (2003) via H. Ahlenius, Nordpil (ODC-By 1.0). -->
<g id="sphere"><path d="${sphere()}"/></g>
<g id="graticule"><path vector-effect="non-scaling-stroke" d="${graticule()}"/></g>
<g id="land"><path d="${land(landCollection)}"/></g>
<g id="plates"><path vector-effect="non-scaling-stroke" d="${plates(plateCollection)}"/></g>
</svg>
`;

await writeFile(OUTPUT, svg);
console.log(`Wrote ${OUTPUT.pathname} (${(svg.length / 1024).toFixed(1)} KiB)`);
