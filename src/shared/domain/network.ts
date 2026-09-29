/**
 * Contributing networks of the Advanced National Seismic System, by the code
 * the USGS uses in event ids. Regional networks locate their own events, which
 * is why a Californian micro-quake and a Pacific M6 in the same feed can carry
 * different magnitude types.
 */
const NETWORKS: Readonly<Record<string, string>> = {
  us: 'USGS National Earthquake Information Center',
  ak: 'Alaska Earthquake Center',
  av: 'Alaska Volcano Observatory',
  at: 'National Tsunami Warning Center',
  ci: 'Southern California Seismic Network',
  hv: 'Hawaiian Volcano Observatory',
  ld: 'Lamont-Doherty Cooperative Seismographic Network',
  mb: 'Montana Regional Seismic Network',
  nc: 'Northern California Seismic System',
  nm: 'New Madrid Seismic Network',
  nn: 'Nevada Seismological Laboratory',
  ok: 'Oklahoma Geological Survey',
  pr: 'Puerto Rico Seismic Network',
  pt: 'Pacific Tsunami Warning Center',
  tx: 'Texas Seismological Network',
  uu: 'University of Utah Seismograph Stations',
  uw: 'Pacific Northwest Seismic Network',
};

export function networkName(code: string): string | null {
  return NETWORKS[code.toLowerCase()] ?? null;
}
