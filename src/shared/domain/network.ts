/**
 * Contributing networks of the Advanced National Seismic System, by the code
 * the USGS uses in event ids. Regional networks locate their own events, which
 * is why a Californian micro-quake and a Pacific M6 in the same feed can carry
 * different magnitude types.
 */
/** Where a network's stations are dense enough to catch small events. The app names each in words. */
export type NetworkRegion =
  | 'alaska'
  | 'california'
  | 'hawaii'
  | 'montana'
  | 'nevada'
  | 'oklahoma'
  | 'puerto-rico'
  | 'texas'
  | 'utah'
  | 'north-eastern-us'
  | 'central-us'
  | 'south-eastern-us'
  | 'pacific-northwest';

interface Network {
  /** Its own name, which no translation changes. */
  readonly name: string;
  /** Global and warning centres have none. */
  readonly region: NetworkRegion | null;
}

const NETWORKS: Readonly<Record<string, Network>> = {
  us: { name: 'USGS National Earthquake Information Center', region: null },
  ak: { name: 'Alaska Earthquake Center', region: 'alaska' },
  av: { name: 'Alaska Volcano Observatory', region: 'alaska' },
  at: { name: 'National Tsunami Warning Center', region: null },
  ci: { name: 'Southern California Seismic Network', region: 'california' },
  hv: { name: 'Hawaiian Volcano Observatory', region: 'hawaii' },
  ld: { name: 'Lamont-Doherty Cooperative Seismographic Network', region: 'north-eastern-us' },
  mb: { name: 'Montana Regional Seismic Network', region: 'montana' },
  nc: { name: 'Northern California Seismic System', region: 'california' },
  nm: { name: 'New Madrid Seismic Network', region: 'central-us' },
  nn: { name: 'Nevada Seismological Laboratory', region: 'nevada' },
  ok: { name: 'Oklahoma Geological Survey', region: 'oklahoma' },
  pr: { name: 'Puerto Rico Seismic Network', region: 'puerto-rico' },
  pt: { name: 'Pacific Tsunami Warning Center', region: null },
  se: { name: 'Center for Earthquake Research and Information', region: 'south-eastern-us' },
  tx: { name: 'Texas Seismological Network', region: 'texas' },
  uu: { name: 'University of Utah Seismograph Stations', region: 'utah' },
  uw: { name: 'Pacific Northwest Seismic Network', region: 'pacific-northwest' },
};

export function networkName(code: string): string | null {
  return NETWORKS[code.toLowerCase()]?.name ?? null;
}

/**
 * Where the network that located an event covers densely. An event id starts
 * with that network's code, `nc75012345` or `us7000q1ab`, so the live feed
 * needs no field for it.
 */
export function regionOf(eventId: string): NetworkRegion | null {
  return NETWORKS[eventId.slice(0, 2).toLowerCase()]?.region ?? null;
}

/**
 * The size from which the catalogue holds every earthquake on Earth: the NEIC
 * publishes to "a goal of about M4.5 global completeness and about M3.0 U.S.
 * completeness". Below it, an event is there only if a regional network was
 * close enough to catch it.
 * https://www.usgs.gov/programs/earthquake-hazards/national-earthquake-information-center-neic
 */
export const COMPLETE_WORLDWIDE_FROM = 4.5;
