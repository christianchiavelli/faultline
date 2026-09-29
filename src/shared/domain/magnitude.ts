/**
 * Magnitude is not one scale. The feed mixes more than a dozen, each measured
 * from a different part of the seismogram, valid over a different range of
 * sizes and distances. A 3.1 `md` from a Californian network and a 3.1 `mb`
 * from the global network are not the same statement.
 *
 * Summaries follow the USGS definitions:
 * https://www.usgs.gov/programs/earthquake-hazards/magnitude-types
 */
export type MagnitudeFamily =
  'moment' | 'body-wave' | 'surface-wave' | 'local' | 'duration' | 'energy' | 'other';

export interface MagnitudeScale {
  /** Display code, cased the way seismologists write it. */
  readonly code: string;
  readonly name: string;
  readonly family: MagnitudeFamily;
  readonly summary: string;
}

const SCALES: Readonly<Record<string, MagnitudeScale>> = {
  mww: {
    code: 'Mww',
    name: 'Moment W-phase',
    family: 'moment',
    summary:
      'From a moment tensor inversion of the W-phase. The authoritative USGS magnitude when it exists.',
  },
  mwc: {
    code: 'Mwc',
    name: 'Centroid moment',
    family: 'moment',
    summary: 'From a centroid moment tensor inversion of long-period surface waves.',
  },
  mwb: {
    code: 'Mwb',
    name: 'Body-wave moment',
    family: 'moment',
    summary: 'From a moment tensor inversion of long-period P and SH body waves.',
  },
  mwr: {
    code: 'Mwr',
    name: 'Regional moment',
    family: 'moment',
    summary: 'From the seismic moment of a regional moment tensor inversion, for about M4 to 6.5.',
  },
  mw: {
    code: 'Mw',
    name: 'Moment',
    family: 'moment',
    summary: 'From the seismic moment: the physical size of the rupture, not how hard it shook.',
  },
  mwp: {
    code: 'Mwp',
    name: 'Integrated P-wave',
    family: 'moment',
    summary:
      'A moment estimate from the integral of the P-wave displacement, used for fast alerts.',
  },
  mi: {
    code: 'Mi',
    name: 'Integrated P-wave',
    family: 'moment',
    summary:
      'A moment estimate from the integral of the P-wave displacement, used for fast alerts.',
  },
  ms: {
    code: 'Ms',
    name: 'Surface wave',
    family: 'surface-wave',
    summary: 'From the amplitude of Rayleigh surface waves at a period near 20 seconds.',
  },
  ms_20: {
    code: 'Ms20',
    name: 'Surface wave',
    family: 'surface-wave',
    summary: 'From the amplitude of Rayleigh surface waves at a period near 20 seconds.',
  },
  mb: {
    code: 'mb',
    name: 'Short-period body wave',
    family: 'body-wave',
    summary: 'From the amplitude of the first P waves at about 1 second, for about M4 to 6.5.',
  },
  mb_lg: {
    code: 'mb_Lg',
    name: 'Lg wave',
    family: 'surface-wave',
    summary: 'For regional events, from the amplitude of Lg surface waves.',
  },
  ml: {
    code: 'ML',
    name: 'Local',
    family: 'local',
    summary: 'The original 1935 Richter and Gutenberg relationship for local earthquakes.',
  },
  md: {
    code: 'Md',
    name: 'Duration',
    family: 'duration',
    summary: 'From how long the shaking lasts. Used for small events, about M4 and below.',
  },
  me: {
    code: 'Me',
    name: 'Energy',
    family: 'energy',
    summary: 'From the radiated seismic energy, integrated from digital waveforms.',
  },
  mh: {
    code: 'Mh',
    name: 'Non-standard',
    family: 'other',
    summary: 'A non-standard method, used when the standard ones will not work.',
  },
};

export function magnitudeScale(type: string): MagnitudeScale {
  return (
    SCALES[type.toLowerCase()] ?? {
      code: type,
      name: 'Network-specific',
      family: 'other',
      summary: 'A magnitude type specific to the network that reported the event.',
    }
  );
}

/**
 * Radiated seismic energy in joules, from the Gutenberg–Richter energy
 * relation `log10 E = 1.5 M + 4.8`. One whole step is about 32 times the
 * energy, two steps about 1,000.
 *
 * The relation was fitted to surface-wave magnitude and is routinely used with
 * moment magnitude. On local or duration magnitudes it is rougher, but those
 * scales only describe small events, whose energy barely registers next to the
 * largest event of any given day.
 */
export function radiatedEnergy(magnitude: number): number {
  return 10 ** (1.5 * magnitude + 4.8);
}

/** How many times more energy `a` radiates than `b`. */
export function energyRatio(a: number, b: number): number {
  return 10 ** (1.5 * (a - b));
}
