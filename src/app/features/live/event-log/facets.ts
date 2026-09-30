import type { Params } from '@angular/router';
import { DEPTH_CLASSES, depthClassOf, type DepthClass } from '@shared/domain/depth';
import { regionSlug, splitPlace } from '@shared/domain/place';
import { EARTHQUAKE_KIND, type QuakeSummary } from '@shared/domain/quake';
import { capitalise } from '@ui/text';
import { MAGNITUDE_FLOORS, logParams, minimumMagnitude, type LogQuery } from './log-query';

/** An event, with what the log filters it by worked out once. */
export interface LogEntry {
  readonly quake: QuakeSummary;
  /** "California", as the log shows it; `null` for an event with no place name. */
  readonly region: string | null;
  readonly regionSlug: string | null;
  readonly depth: DepthClass | null;
}

export function toEntries(quakes: readonly QuakeSummary[]): LogEntry[] {
  return quakes.map((quake) => {
    const { region } = splitPlace(quake.place);
    return {
      quake,
      region: region ? capitalise(region) : null,
      regionSlug: region ? regionSlug(region) : null,
      depth: depthClassOf(quake.location.depthKm),
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

/** Whether the query shows this entry, leaving one filter out when asked to. */
export function matches(entry: LogEntry, query: LogQuery, except?: FacetKey): boolean {
  return FACET_KEYS.every((key) => key === except || TESTS[key](entry, query));
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
  shallow: 'to 70 km',
  intermediate: 'to 300 km',
  deep: 'below 300 km',
};

/**
 * Every filter with its options and their counts. A count is what the list
 * would hold with that option chosen and the other filters kept, so an option
 * that leads nowhere says so before it is followed.
 */
export function facetsOf(entries: readonly LogEntry[], query: LogQuery): Facet[] {
  const option = (
    key: FacetKey,
    value: string | null,
    label: string,
    hint: string | null = null,
  ): FacetOption => {
    const chosen = { ...query, [key]: value } as LogQuery;
    return {
      value,
      label,
      hint,
      count: entries.filter((entry) => matches(entry, query, key) && TESTS[key](entry, chosen))
        .length,
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
      label: 'Magnitude',
      options: MAGNITUDE_FLOORS.map((floor) => option('magnitude', floor.value, floor.label)),
      all: null,
    },
    {
      key: 'region',
      label: 'Region',
      options: [option('region', null, 'Anywhere'), ...shown],
      all: everyRegion.length > TOP_REGIONS ? everyRegion : null,
    },
    {
      key: 'depth',
      label: 'Depth',
      options: [
        option('depth', null, 'Any'),
        ...DEPTH_CLASSES.map((depth) =>
          option('depth', depth.value, depth.label, DEPTH_HINTS[depth.value]),
        ),
      ],
      all: null,
    },
    {
      key: 'review',
      label: 'Review',
      options: [
        option('review', null, 'Any'),
        option('review', 'reviewed', 'Reviewed'),
        option('review', 'automatic', 'Automatic'),
      ],
      all: null,
    },
    {
      key: 'kind',
      label: 'Kind',
      options: [
        option('kind', null, 'Any'),
        option('kind', 'earthquake', 'Earthquakes'),
        option('kind', 'other', 'Other events'),
      ],
      all: null,
    },
  ];
}

/** "M2.5 and up · Alaska · shallow": the filters in force, as one line of text. */
export function describeFilters(facets: readonly Facet[]): string {
  return facets
    .flatMap((facet) => {
      const current = facet.options.find((option) => option.current);
      if (!current) return [];
      if (facet.key === 'magnitude') {
        return current.value === 'any' ? ['any magnitude'] : [`M${current.label}`];
      }
      if (current.value === null) return [];
      return [facet.key === 'region' ? current.label : current.label.toLowerCase()];
    })
    .join(' · ');
}
