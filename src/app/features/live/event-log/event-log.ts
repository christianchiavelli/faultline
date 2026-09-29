import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { magnitudeScale } from '@shared/domain/magnitude';
import { EARTHQUAKE_KIND, type QuakeSummary } from '@shared/domain/quake';
import { capitalise } from '@ui/text';

export const MAGNITUDE_FILTERS = [
  { value: 'all', label: 'All', min: null },
  { value: '2.5', label: 'M2.5+', min: 2.5 },
  { value: '4.5', label: 'M4.5+', min: 4.5 },
] as const;

export type MagnitudeFilter = (typeof MAGNITUDE_FILTERS)[number]['value'];

/**
 * M2.5 by default: below it the log is mostly the dense micro-seismicity of a
 * few Californian and Alaskan networks, and the trace above already shows it.
 */
export function parseMagnitudeFilter(value: string | null | undefined): MagnitudeFilter {
  return MAGNITUDE_FILTERS.find((filter) => filter.value === value)?.value ?? '2.5';
}

function passes(quake: QuakeSummary, min: number | null): boolean {
  return min === null || (quake.magnitude?.value ?? -Infinity) >= min;
}

@Component({
  selector: 'fl-event-log',
  imports: [RouterLink, DatePipe],
  templateUrl: './event-log.html',
  styleUrl: './event-log.css',
})
export class EventLog {
  readonly quakes = input.required<readonly QuakeSummary[]>();
  readonly filter = input.required<MagnitudeFilter>();

  readonly filters = computed(() =>
    MAGNITUDE_FILTERS.map((filter) => ({
      ...filter,
      count: this.quakes().filter((quake) => passes(quake, filter.min)).length,
      current: filter.value === this.filter(),
    })),
  );

  readonly visible = computed(() => {
    const { min } = MAGNITUDE_FILTERS.find((filter) => filter.value === this.filter())!;
    return this.quakes().filter((quake) => passes(quake, min));
  });

  /** Grouped by UTC day, the way a station logbook turns the page at midnight. */
  readonly days = computed(() => {
    const days = new Map<string, { day: number; rows: Row[] }>();
    for (const quake of this.visible()) {
      const key = new Date(quake.time).toISOString().slice(0, 10);
      const day = days.get(key) ?? { day: quake.time, rows: [] };
      day.rows.push(toRow(quake));
      days.set(key, day);
    }
    return [...days.values()];
  });

  readonly hasNegativeDepth = computed(() =>
    this.visible().some((quake) => (quake.location.depthKm ?? 0) < 0),
  );
}

interface Row {
  readonly id: string;
  readonly time: number;
  readonly magnitude: string | null;
  readonly scale: { readonly code: string; readonly title: string } | null;
  readonly place: string;
  readonly kind: string | null;
  readonly depth: string | null;
  readonly depthTitle: string | null;
  readonly reviewed: boolean;
}

function toRow(quake: QuakeSummary): Row {
  const scale = quake.magnitude ? magnitudeScale(quake.magnitude.type) : null;
  const depth = quake.location.depthKm;
  return {
    id: quake.id,
    time: quake.time,
    magnitude: quake.magnitude ? quake.magnitude.value.toFixed(1) : null,
    scale: scale ? { code: scale.code, title: `${scale.name}. ${scale.summary}` } : null,
    place: quake.place ? capitalise(quake.place) : 'Location not described',
    kind: quake.kind === EARTHQUAKE_KIND ? null : quake.kind,
    depth: depth === null ? null : depth.toFixed(1).replace('-', '−'),
    depthTitle:
      depth !== null && depth < 0 ? `${Math.abs(depth).toFixed(1)} km above sea level` : null,
    reviewed: quake.review === 'reviewed',
  };
}
