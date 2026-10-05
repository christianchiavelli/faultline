import type { Params } from '@angular/router';
import { depthName } from '@core/words/domain';
import { formatMagnitude } from '@core/words/magnitude';
import { DEPTH_CLASSES, depthClassOf, type DepthClass } from '@shared/domain/depth';
import { regionSlug, splitPlace } from '@shared/domain/place';
import { EARTHQUAKE_KIND, type QuakeSummary } from '@shared/domain/quake';
import { capitalise, fold, searchWords } from '@ui/text';
import {
  MAGNITUDE_FLOORS,
  logParams,
  minimumMagnitude,
  type LogOrder,
  type LogQuery,
} from './log-query';

/** An event, with what the log filters it by worked out once. */
export interface LogEntry {
  readonly quake: QuakeSummary;
  /** "California", as the log shows it, in the catalogue's words; `null` for an event with no place name. */
  readonly region: string | null;
  readonly regionSlug: string | null;
  readonly depth: DepthClass | null;
  /** The place name and its region as a search compares them, so "california" finds "…, CA". */
  readonly text: string;
}

export function toEntries(quakes: readonly QuakeSummary[]): LogEntry[] {
  return quakes.map((quake) => {
    const { region } = splitPlace(quake.place);
    return {
      quake,
      region: region ? capitalise(region) : null,
      regionSlug: region ? regionSlug(region) : null,
      depth: depthClassOf(quake.location.depthKm),
      text: fold(`${quake.place ?? ''} ${region ?? ''}`),
    };
  });
}

/** The filters, named as the query names them. */
export type FacetKey = 'magnitude' | 'region' | 'depth' | 'review' | 'kind';

const FACET_KEYS: readonly FacetKey[] = ['magnitude', 'region', 'depth', 'review', 'kind'];

const TESTS: Record<FacetKey, (entry: LogEntry, query: LogQuery) => boolean> = {
  magnitude: ({ quake }, { magnitude }) => {
    const min = minimumMagnitude(magnitude);
    return min === null || (quake.magnitude?.value ?? -Infinity) >= min;
  },
  region: (entry, { region }) => region === null || entry.regionSlug === region,
  depth: (entry, { depth }) => depth === null || entry.depth === depth,
  review: ({ quake }, { review }) => review === null || quake.review === review,
  kind: ({ quake }, { kind }) =>
    kind === null || (kind === 'earthquake') === (quake.kind === EARTHQUAKE_KIND),
};

/**
 * Whether the query shows an entry, leaving one filter out when asked to.
 * The search always applies: the counts are of what the reader is looking for.
 * Made once per query and filter, so the search is read once, not once per
 * entry: the facets alone test every entry once for each of their options.
 */
export function matcher(query: LogQuery, except?: FacetKey): (entry: LogEntry) => boolean {
  const keys = FACET_KEYS.filter((key) => key !== except);
  const words = searchWords(query.search);
  return (entry) =>
    keys.every((key) => TESTS[key](entry, query)) &&
    words.every((word) => entry.text.includes(word));
}

export interface FacetOption {
  /** The value as the address writes it; `null` is the facet's "any". */
  readonly value: string | null;
  readonly label: string;
  readonly hint: string | null;
  /** How many events the log would hold with this choice, every other filter kept. */
  readonly count: number;
  readonly current: boolean;
  /** The address of that view. */
  readonly params: Params;
}

export interface Facet {
  readonly key: FacetKey;
  readonly label: string;
  readonly options: readonly FacetOption[];
  /** Every option of a facet too long to show whole, the regions: one link away. */
  readonly all: readonly FacetOption[] | null;
}

/** The busiest regions of the day, about as many options as the other facets have. */
const TOP_REGIONS = 4;

const DEPTH_HINTS: Record<DepthClass, string> = {
  shallow: $localize`:the depths of the shallow class, under its filter option:to 70 km`,
  intermediate: $localize`:the depths of the intermediate class, under its filter option:to 300 km`,
  deep: $localize`:the depths of the deep class, under its filter option:below 300 km`,
};

/** The option that leaves a filter off, whichever filter it is. */
const ANY = $localize`:filter option of the log that leaves its filter off:Any`;

/** "2.5 and up": a magnitude floor as the facet offers it. */
function floorOption(min: number | null, locale: string): string {
  if (min === null) return ANY;
  const magnitude = formatMagnitude(min, locale);
  return $localize`:a magnitude floor, as a filter option of the log, as in 2.5 and up:${magnitude}:magnitude: and up`;
}

/**
 * Every filter with its options and their counts. A count is what the list
 * would hold with that option chosen and the other filters kept, so an option
 * that leads nowhere says so before it is followed. `locale` sets the
 * numbers in the options' words.
 */
export function facetsOf(entries: readonly LogEntry[], query: LogQuery, locale: string): Facet[] {
  const option = (
    key: FacetKey,
    value: string | null,
    label: string,
    hint: string | null = null,
  ): FacetOption => {
    const chosen = { ...query, [key]: value } as LogQuery;
    const shown = matcher(query, key);
    return {
      value,
      label,
      hint,
      count: entries.filter((entry) => shown(entry) && TESTS[key](entry, chosen)).length,
      current: query[key] === value,
      params: logParams(chosen),
    };
  };

  const regions = new Map<string, string>();
  for (const entry of entries) {
    if (entry.regionSlug && entry.region) regions.set(entry.regionSlug, entry.region);
  }
  const everyRegion = [...regions]
    .map(([slug, name]) => option('region', slug, name))
    .filter((region) => region.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'en'));
  const shown = everyRegion.slice(0, TOP_REGIONS);
  const chosen = query.region;
  if (chosen && !shown.some((region) => region.value === chosen)) {
    shown.push(
      everyRegion.find((region) => region.value === chosen) ??
        // Emptied by another filter, or named by a shared address after its events rolled off the day.
        option('region', chosen, regions.get(chosen) ?? capitalise(chosen.replaceAll('-', ' '))),
    );
  }

  return [
    {
      key: 'magnitude',
      label: $localize`:heading of a filter of the log|which sizes it lists:Magnitude`,
      options: MAGNITUDE_FLOORS.map((floor) =>
        option('magnitude', floor.value, floorOption(floor.min, locale)),
      ),
      all: null,
    },
    {
      key: 'region',
      label: $localize`:heading of a filter of the log|where the events are:Region`,
      options: [
        option(
          'region',
          null,
          $localize`:filter option of the log that leaves the region filter off:Anywhere`,
        ),
        ...shown,
      ],
      all: everyRegion.length > TOP_REGIONS ? everyRegion : null,
    },
    {
      key: 'depth',
      label: $localize`:heading of a filter of the log|how deep the events are:Depth`,
      options: [
        option('depth', null, ANY),
        ...DEPTH_CLASSES.map(({ value }) =>
          option('depth', value, depthName(value), DEPTH_HINTS[value]),
        ),
      ],
      all: null,
    },
    {
      key: 'review',
      label: $localize`:heading of a filter of the log|whether a seismologist has checked the events:Review`,
      options: [
        option('review', null, ANY),
        option(
          'review',
          'reviewed',
          $localize`:filter option of the log|the events a seismologist has checked:Reviewed`,
        ),
        option(
          'review',
          'automatic',
          $localize`:filter option of the log|the events no seismologist has checked yet:Automatic`,
        ),
      ],
      all: null,
    },
    {
      key: 'kind',
      label: $localize`:heading of a filter of the log|what kind of event they are:Kind`,
      options: [
        option('kind', null, ANY),
        option(
          'kind',
          'earthquake',
          $localize`:filter option of the log|the earthquakes alone:Earthquakes`,
        ),
        option(
          'kind',
          'other',
          $localize`:filter option of the log|explosions, quarry blasts and every other kind but earthquakes:Other events`,
        ),
      ],
      all: null,
    },
  ];
}

/** "M2.5 and up", or "any magnitude": the floor the list has, said beside its count. */
export function describeFloor(query: LogQuery, locale: string): string {
  const min = minimumMagnitude(query.magnitude);
  if (min === null) {
    return $localize`:the log's magnitude floor beside its count, when it has none:any magnitude`;
  }
  const magnitude = formatMagnitude(min, locale);
  return $localize`:the log's magnitude floor beside its count, as in M2.5 and up:M${magnitude}:magnitude: and up`;
}

/** A filter narrowing the list, and the address of the view without it. */
export interface FilterOn {
  readonly key: FacetKey | 'search';
  readonly label: string;
  readonly params: Params;
}

/**
 * The filters in force, each with its way back. The magnitude floor is not
 * among them: the list always has one, so its count names it instead.
 */
export function filtersOn(facets: readonly Facet[], query: LogQuery): FilterOn[] {
  const on = facets.flatMap((facet): FilterOn[] => {
    const current = facet.options.find((option) => option.current);
    const any = facet.options.find((option) => option.value === null);
    return facet.key !== 'magnitude' && current?.value && any
      ? [{ key: facet.key, label: current.label, params: any.params }]
      : [];
  });
  if (query.search) {
    on.push({
      key: 'search',
      label: `“${query.search}”`,
      params: logParams({ ...query, search: '' }),
    });
  }
  return on;
}

const byTime = (a: LogEntry, b: LogEntry) => b.quake.time - a.quake.time;

/** Largest or deepest first, missing values last, and the newest first among equals. */
const ORDERS: Record<LogOrder, (a: LogEntry, b: LogEntry) => number> = {
  newest: byTime,
  largest: (a, b) =>
    (b.quake.magnitude?.value ?? -Infinity) - (a.quake.magnitude?.value ?? -Infinity) ||
    byTime(a, b),
  deepest: (a, b) =>
    (b.quake.location.depthKm ?? -Infinity) - (a.quake.location.depthKm ?? -Infinity) ||
    byTime(a, b),
};

export function sortEntries(entries: readonly LogEntry[], order: LogOrder): LogEntry[] {
  return [...entries].sort(ORDERS[order]);
}
