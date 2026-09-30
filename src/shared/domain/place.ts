/**
 * A USGS place name is a locality, then its region after the last comma:
 * "12 km SSE of Ridgecrest, CA". An event far from any named place has only a
 * region, one of the Flinn–Engdahl seismic regions: "Balleny Islands region",
 * "Mid-Atlantic Ridge".
 */
export interface PlaceName {
  /** "12 km SSE of Ridgecrest"; `null` when the USGS names only a region. */
  readonly locality: string | null;
  /** "California"; `null` when the event has no place name at all. */
  readonly region: string | null;
}

/**
 * The Californian networks write two regions as codes: California itself,
 * and Mexico after a Baja California locality ("…, B.C., MX"). Every other
 * network spells its region out.
 */
const REGION_CODES: Readonly<Record<string, string>> = { CA: 'California', MX: 'Mexico' };

export function splitPlace(place: string | null): PlaceName {
  const name = place?.trim();
  if (!name) return { locality: null, region: null };
  const comma = name.lastIndexOf(', ');
  if (comma < 0) return { locality: null, region: regionName(name) };
  return { locality: name.slice(0, comma), region: regionName(name.slice(comma + 2)) };
}

/** "Fiji region" alone and "…, Fiji" after a locality are one region to a reader. */
function regionName(raw: string): string {
  const name = raw.replace(/ region$/, '');
  return REGION_CODES[name] ?? name;
}

/** `us-virgin-islands`: a region as it reads in an address bar, without accents or dots. */
export function regionSlug(region: string): string {
  return region
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
