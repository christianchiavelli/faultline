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

/** A scale as the catalogue names it. What it is called, and what it measures, the app says in words. */
export interface MagnitudeScale {
  /** The catalogue's code, lowercased: the key its words are kept under. */
  readonly key: string;
  /** Display code, cased the way seismologists write it. */
  readonly code: string;
  readonly family: MagnitudeFamily;
}

const SCALES: Readonly<Record<string, Omit<MagnitudeScale, 'key'>>> = {
  mww: { code: 'Mww', family: 'moment' },
  mwc: { code: 'Mwc', family: 'moment' },
  mwb: { code: 'Mwb', family: 'moment' },
  mwr: { code: 'Mwr', family: 'moment' },
  mw: { code: 'Mw', family: 'moment' },
  mwp: { code: 'Mwp', family: 'moment' },
  mi: { code: 'Mi', family: 'moment' },
  ms: { code: 'Ms', family: 'surface-wave' },
  ms_20: { code: 'Ms20', family: 'surface-wave' },
  mb: { code: 'mb', family: 'body-wave' },
  mb_lg: { code: 'mb_Lg', family: 'surface-wave' },
  ml: { code: 'ML', family: 'local' },
  md: { code: 'Md', family: 'duration' },
  me: { code: 'Me', family: 'energy' },
  mh: { code: 'Mh', family: 'other' },
};

/** A code the catalogue does not define stays as the network wrote it, measuring what that network says. */
export function magnitudeScale(type: string): MagnitudeScale {
  const key = type.toLowerCase();
  return { key, ...(SCALES[key] ?? { code: type, family: 'other' }) };
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

/**
 * Earthquakes of M5 to 5.9 in an average year worldwide, in the USGS table of
 * how often each size happens, "based on observations since 1990". The
 * smaller classes in that table are estimates made from this one, since no
 * network catches them all; this one is counted.
 * https://ds.iris.edu/ds/support/faq/7/is-the-number-of-earthquakes-increasing/
 */
const M5_A_YEAR = 1319;

/**
 * How many earthquakes an average day brings worldwide with a magnitude from
 * `from` up to `to`, by the Gutenberg–Richter law: about ten times as many for
 * each whole step down (b = 1), anchored on the counted rate of M5s.
 */
export function expectedPerDay(from: number, to: number): number {
  const fiveAndUp = M5_A_YEAR / (1 - 10 ** -1) / 365.25;
  return fiveAndUp * (10 ** (5 - from) - 10 ** (5 - to));
}
