import { magnitudeScale, type MagnitudeScale } from '@shared/domain/magnitude';

export interface ScaleInWords extends MagnitudeScale {
  /** What it is called, as in "Moment W-phase magnitude". */
  readonly name: string;
  /** What it measures, in a sentence or two. */
  readonly summary: string;
  /** What a pointer resting on its code reads: the name, then what it measures. */
  readonly title: string;
}

type Words = Pick<ScaleInWords, 'name' | 'summary'>;

const INTEGRATED_P_WAVE: Words = {
  name: $localize`:name of the magnitude scales Mwp and Mi:Integrated P-wave magnitude`,
  summary: $localize`:what the magnitude scales Mwp and Mi measure:A moment estimate from the integral of the P-wave displacement, used for fast alerts.`,
};

const SURFACE_WAVE: Words = {
  name: $localize`:name of the magnitude scales Ms and Ms20:Surface wave magnitude`,
  summary: $localize`:what the magnitude scales Ms and Ms20 measure:From the amplitude of Rayleigh surface waves at a period near 20 seconds.`,
};

/** After the USGS definitions: https://www.usgs.gov/programs/earthquake-hazards/magnitude-types */
const SCALES: Readonly<Record<string, Words>> = {
  mww: {
    name: $localize`:name of the magnitude scale Mww:Moment W-phase magnitude`,
    summary: $localize`:what the magnitude scale Mww measures:From a moment tensor inversion of the W-phase. The authoritative USGS magnitude when it exists.`,
  },
  mwc: {
    name: $localize`:name of the magnitude scale Mwc:Centroid moment magnitude`,
    summary: $localize`:what the magnitude scale Mwc measures:From a centroid moment tensor inversion of long-period surface waves.`,
  },
  mwb: {
    name: $localize`:name of the magnitude scale Mwb:Body-wave moment magnitude`,
    summary: $localize`:what the magnitude scale Mwb measures:From a moment tensor inversion of long-period P and SH body waves.`,
  },
  mwr: {
    name: $localize`:name of the magnitude scale Mwr:Regional moment magnitude`,
    summary: $localize`:what the magnitude scale Mwr measures:From the seismic moment of a regional moment tensor inversion, for about M4 to 6.5.`,
  },
  mw: {
    name: $localize`:name of the magnitude scale Mw:Moment magnitude`,
    summary: $localize`:what the magnitude scale Mw measures:From the seismic moment: the physical size of the rupture, not how hard it shook.`,
  },
  mwp: INTEGRATED_P_WAVE,
  mi: INTEGRATED_P_WAVE,
  ms: SURFACE_WAVE,
  ms_20: SURFACE_WAVE,
  mb: {
    name: $localize`:name of the magnitude scale mb:Short-period body wave magnitude`,
    summary: $localize`:what the magnitude scale mb measures:From the amplitude of the first P waves at about 1 second, for about M4 to 6.5.`,
  },
  mb_lg: {
    name: $localize`:name of the magnitude scale mb_Lg:Lg wave magnitude`,
    summary: $localize`:what the magnitude scale mb_Lg measures:For regional events, from the amplitude of Lg surface waves.`,
  },
  ml: {
    name: $localize`:name of the magnitude scale ML:Local magnitude`,
    summary: $localize`:what the magnitude scale ML measures:The original 1935 Richter and Gutenberg relationship for local earthquakes.`,
  },
  md: {
    name: $localize`:name of the magnitude scale Md:Duration magnitude`,
    summary: $localize`:what the magnitude scale Md measures:From how long the shaking lasts. Used for small events, about M4 and below.`,
  },
  me: {
    name: $localize`:name of the magnitude scale Me:Energy magnitude`,
    summary: $localize`:what the magnitude scale Me measures:From the radiated seismic energy, integrated from digital waveforms.`,
  },
  mh: {
    name: $localize`:name of the magnitude scale Mh:Non-standard magnitude`,
    summary: $localize`:what the magnitude scale Mh measures:A non-standard method, used when the standard ones will not work.`,
  },
};

const NETWORK_SPECIFIC: Words = {
  name: $localize`:name for a magnitude scale only the network that reported the event uses:Network-specific magnitude`,
  summary: $localize`:what such a magnitude scale measures:A magnitude type specific to the network that reported the event.`,
};

/** The scale a magnitude was measured on, as the reader meets it: its code, its name, what it measures. */
export function describeScale(type: string): ScaleInWords {
  const scale = magnitudeScale(type);
  const words = SCALES[scale.key] ?? NETWORK_SPECIFIC;
  return { ...scale, ...words, title: `${words.name}. ${words.summary}` };
}
