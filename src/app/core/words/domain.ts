import type { DepthClass } from '@shared/domain/depth';
import type { NetworkRegion } from '@shared/domain/network';
import type { AlertLevel, ReviewStatus } from '@shared/domain/quake';
import { formatDecimal } from '@ui/numbers';
import { capitalise } from '@ui/text';

/*
 * The domain in the reader's words. `src/shared` deals in codes, the same in
 * every language, and the app turns them into words here, each one marked for
 * translation with what it means.
 */

/** An event's place, as the catalogue writes it, or what stands in for it when there is none. */
export function placeName(place: string | null): string {
  return place
    ? capitalise(place)
    : $localize`:in place of an event's place name, when the USGS gives none:Location not described`;
}

/** "10.0 km deep", or "1.2 km above sea level": under a mountain, an event is located from the sea. */
export function depthPhrase(depthKm: number, locale: string): string {
  const km = formatDecimal(Math.abs(depthKm), locale, '1.1-1');
  return depthKm < 0
    ? $localize`:an event's height above sea level, as in 1.2 km above sea level:${km}:height: km above sea level`
    : $localize`:an event's depth, as in 10.0 km deep:${km}:depth: km deep`;
}

/** Whether a seismologist has checked an event, as a tag beside it. */
const REVIEW_TAGS: Readonly<Record<ReviewStatus, string>> = {
  reviewed: $localize`:review status of one event, as a tag beside it|checked by a seismologist:Reviewed`,
  automatic: $localize`:review status of one event, as a tag beside it|not yet checked by a seismologist:Automatic`,
};

export function reviewTag(review: ReviewStatus): string {
  return REVIEW_TAGS[review];
}

/**
 * PAGER estimates impact from the shaking and the population exposed to it,
 * within minutes of an event. The levels summarise its fatality and economic
 * loss estimates; they are a forecast, not a count.
 */
const ALERTS: Readonly<Record<AlertLevel, string>> = {
  green: $localize`:what a green PAGER impact alert forecasts:Little or no damage or loss of life expected.`,
  yellow: $localize`:what a yellow PAGER impact alert forecasts:Some damage and a few casualties possible.`,
  orange: $localize`:what an orange PAGER impact alert forecasts:Significant damage and casualties likely.`,
  red: $localize`:what a red PAGER impact alert forecasts:Extensive damage and many casualties likely.`,
};

export function alertMeaning(level: AlertLevel): string {
  return ALERTS[level];
}

/** The level itself, as in "PAGER orange". */
const ALERT_LEVELS: Readonly<Record<AlertLevel, string>> = {
  green: $localize`:a PAGER impact alert level, after the word PAGER:green`,
  yellow: $localize`:a PAGER impact alert level, after the word PAGER:yellow`,
  orange: $localize`:a PAGER impact alert level, after the word PAGER:orange`,
  red: $localize`:a PAGER impact alert level, after the word PAGER:red`,
};

export function alertLevelName(level: AlertLevel): string {
  return ALERT_LEVELS[level];
}

const DEPTHS: Readonly<Record<DepthClass, string>> = {
  shallow: $localize`:depth class of earthquakes down to 70 km, as a filter option:Shallow`,
  intermediate: $localize`:depth class of earthquakes from 70 to 300 km, as a filter option:Intermediate`,
  deep: $localize`:depth class of earthquakes below 300 km, as a filter option:Deep`,
};

export function depthName(depth: DepthClass): string {
  return DEPTHS[depth];
}

/** Each in the form it takes in a list, as in "California, Alaska and the central US". */
const REGIONS: Readonly<Record<NetworkRegion, string>> = {
  alaska: $localize`:a region dense with seismometers, in a list:Alaska`,
  california: $localize`:a region dense with seismometers, in a list:California`,
  hawaii: $localize`:a region dense with seismometers, in a list:Hawaii`,
  montana: $localize`:a region dense with seismometers, in a list:Montana`,
  nevada: $localize`:a region dense with seismometers, in a list:Nevada`,
  oklahoma: $localize`:a region dense with seismometers, in a list:Oklahoma`,
  'puerto-rico': $localize`:a region dense with seismometers, in a list:Puerto Rico`,
  texas: $localize`:a region dense with seismometers, in a list:Texas`,
  utah: $localize`:a region dense with seismometers, in a list:Utah`,
  'north-eastern-us': $localize`:a region dense with seismometers, in a list:the north-eastern US`,
  'central-us': $localize`:a region dense with seismometers, in a list:the central US`,
  'south-eastern-us': $localize`:a region dense with seismometers, in a list:the south-eastern US`,
  'pacific-northwest': $localize`:a region dense with seismometers, in a list:the Pacific Northwest`,
};

export function regionName(region: NetworkRegion): string {
  return REGIONS[region];
}

interface KindWords {
  readonly name: string;
  readonly one: (count: number) => string;
  readonly other: (count: number) => string;
}

/**
 * The kinds of event the USGS catalogues, by the word its feed uses. One it
 * has not used before keeps that word: like a place name, it is the
 * catalogue's own.
 */
const KINDS: Readonly<Record<string, KindWords>> = {
  earthquake: {
    name: $localize`:kind of seismic event, alone:earthquake`,
    one: (n) => $localize`:a count of earthquakes, exactly one:${n}:count: earthquake`,
    other: (n) => $localize`:a count of earthquakes, any but one:${n}:count: earthquakes`,
  },
  explosion: {
    name: $localize`:kind of seismic event, alone:explosion`,
    one: (n) => $localize`:a count of explosions, exactly one:${n}:count: explosion`,
    other: (n) => $localize`:a count of explosions, any but one:${n}:count: explosions`,
  },
  'quarry blast': {
    name: $localize`:kind of seismic event, alone:quarry blast`,
    one: (n) => $localize`:a count of quarry blasts, exactly one:${n}:count: quarry blast`,
    other: (n) => $localize`:a count of quarry blasts, any but one:${n}:count: quarry blasts`,
  },
  'chemical explosion': {
    name: $localize`:kind of seismic event, alone:chemical explosion`,
    one: (n) =>
      $localize`:a count of chemical explosions, exactly one:${n}:count: chemical explosion`,
    other: (n) =>
      $localize`:a count of chemical explosions, any but one:${n}:count: chemical explosions`,
  },
  'mining explosion': {
    name: $localize`:kind of seismic event, alone:mining explosion`,
    one: (n) => $localize`:a count of mining explosions, exactly one:${n}:count: mining explosion`,
    other: (n) =>
      $localize`:a count of mining explosions, any but one:${n}:count: mining explosions`,
  },
  'nuclear explosion': {
    name: $localize`:kind of seismic event, alone:nuclear explosion`,
    one: (n) =>
      $localize`:a count of nuclear explosions, exactly one:${n}:count: nuclear explosion`,
    other: (n) =>
      $localize`:a count of nuclear explosions, any but one:${n}:count: nuclear explosions`,
  },
  'experimental explosion': {
    name: $localize`:kind of seismic event, alone:experimental explosion`,
    one: (n) =>
      $localize`:a count of experimental explosions, exactly one:${n}:count: experimental explosion`,
    other: (n) =>
      $localize`:a count of experimental explosions, any but one:${n}:count: experimental explosions`,
  },
  'ice quake': {
    name: $localize`:kind of seismic event, alone:ice quake`,
    one: (n) => $localize`:a count of ice quakes, exactly one:${n}:count: ice quake`,
    other: (n) => $localize`:a count of ice quakes, any but one:${n}:count: ice quakes`,
  },
  'rock burst': {
    name: $localize`:kind of seismic event, alone:rock burst`,
    one: (n) => $localize`:a count of rock bursts, exactly one:${n}:count: rock burst`,
    other: (n) => $localize`:a count of rock bursts, any but one:${n}:count: rock bursts`,
  },
  landslide: {
    name: $localize`:kind of seismic event, alone:landslide`,
    one: (n) => $localize`:a count of landslides, exactly one:${n}:count: landslide`,
    other: (n) => $localize`:a count of landslides, any but one:${n}:count: landslides`,
  },
  'snow avalanche': {
    name: $localize`:kind of seismic event, alone:snow avalanche`,
    one: (n) => $localize`:a count of snow avalanches, exactly one:${n}:count: snow avalanche`,
    other: (n) => $localize`:a count of snow avalanches, any but one:${n}:count: snow avalanches`,
  },
  'volcanic eruption': {
    name: $localize`:kind of seismic event, alone:volcanic eruption`,
    one: (n) =>
      $localize`:a count of volcanic eruptions, exactly one:${n}:count: volcanic eruption`,
    other: (n) =>
      $localize`:a count of volcanic eruptions, any but one:${n}:count: volcanic eruptions`,
  },
  'sonic boom': {
    name: $localize`:kind of seismic event, alone:sonic boom`,
    one: (n) => $localize`:a count of sonic booms, exactly one:${n}:count: sonic boom`,
    other: (n) => $localize`:a count of sonic booms, any but one:${n}:count: sonic booms`,
  },
  collapse: {
    name: $localize`:kind of seismic event, alone:collapse`,
    one: (n) => $localize`:a count of collapses, exactly one:${n}:count: collapse`,
    other: (n) => $localize`:a count of collapses, any but one:${n}:count: collapses`,
  },
  'acoustic noise': {
    name: $localize`:kind of seismic event, alone:acoustic noise`,
    one: (n) =>
      $localize`:a count of acoustic noise events, exactly one:${n}:count: acoustic noise`,
    other: (n) =>
      $localize`:a count of acoustic noise events, any but one:${n}:count: acoustic noises`,
  },
  meteorite: {
    name: $localize`:kind of seismic event, alone:meteorite`,
    one: (n) => $localize`:a count of meteorites, exactly one:${n}:count: meteorite`,
    other: (n) => $localize`:a count of meteorites, any but one:${n}:count: meteorites`,
  },
  'other event': {
    name: $localize`:kind of seismic event, alone:other event`,
    one: (n) => $localize`:a count of other events, exactly one:${n}:count: other event`,
    other: (n) => $localize`:a count of other events, any but one:${n}:count: other events`,
  },
};

/** "explosion", "quarry blast": the kind of an event, lowercase as the catalogue writes it. */
export function kindName(kind: string): string {
  return KINDS[kind]?.name ?? kind;
}

/**
 * "1 explosion", "7 explosions". Whole counts of events that happened: one is
 * singular and anything more is plural, in English and in Portuguese alike. A
 * language that counts in more forms would need ICU messages here instead.
 */
export function countKind(kind: string, count: number): string {
  const words = KINDS[kind];
  if (!words) return `${count} ${kind}`;
  return count === 1 ? words.one(count) : words.other(count);
}
