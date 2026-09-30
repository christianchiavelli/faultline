/**
 * Contributing networks of the Advanced National Seismic System, by the code
 * the USGS uses in event ids. Regional networks locate their own events, which
 * is why a Californian micro-quake and a Pacific M6 in the same feed can carry
 * different magnitude types.
 */
interface Network {
  readonly name: string;
  /** Where its stations are dense enough to catch small events. Global and warning centres have none. */
  readonly region: string | null;
}

const NETWORKS: Readonly<Record<string, Network>> = {
  us: { name: 'USGS National Earthquake Information Center', region: null },
  ak: { name: 'Alaska Earthquake Center', region: 'Alaska' },
  av: { name: 'Alaska Volcano Observatory', region: 'Alaska' },
  at: { name: 'National Tsunami Warning Center', region: null },
  ci: { name: 'Southern California Seismic Network', region: 'California' },
  hv: { name: 'Hawaiian Volcano Observatory', region: 'Hawaii' },
  ld: { name: 'Lamont-Doherty Cooperative Seismographic Network', region: 'the north-eastern US' },
  mb: { name: 'Montana Regional Seismic Network', region: 'Montana' },
  nc: { name: 'Northern California Seismic System', region: 'California' },
  nm: { name: 'New Madrid Seismic Network', region: 'the central US' },
  nn: { name: 'Nevada Seismological Laboratory', region: 'Nevada' },
  ok: { name: 'Oklahoma Geological Survey', region: 'Oklahoma' },
  pr: { name: 'Puerto Rico Seismic Network', region: 'Puerto Rico' },
  pt: { name: 'Pacific Tsunami Warning Center', region: null },
  se: { name: 'Center for Earthquake Research and Information', region: 'the south-eastern US' },
  tx: { name: 'Texas Seismological Network', region: 'Texas' },
  uu: { name: 'University of Utah Seismograph Stations', region: 'Utah' },
  uw: { name: 'Pacific Northwest Seismic Network', region: 'the Pacific Northwest' },
};

export function networkName(code: string): string | null {
  return NETWORKS[code.toLowerCase()]?.name ?? null;
}

/**
 * Where the network that located an event covers densely. An event id starts
 * with that network's code, `nc75012345` or `us7000q1ab`, so the live feed
 * needs no field for it.
 */
export function regionOf(eventId: string): string | null {
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
