import { DatePipe } from '@angular/common';
import {
  Component,
  type ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
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
 * About a laptop screen of the log. The rest is one link away, in the address
 * bar like the filter, so it can be shared and undone with Back.
 */
export const LATEST = 10;

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

function minimumOf(filter: MagnitudeFilter): number | null {
  return MAGNITUDE_FILTERS.find((candidate) => candidate.value === filter)!.min;
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
  /** Every event at this filter, not only the latest: `?rows=all`. */
  readonly unfolded = input(false);

  readonly #injector = inject(Injector);
  private readonly places = viewChildren<ElementRef<HTMLAnchorElement>>('place');
  private readonly fold = viewChild<ElementRef<HTMLAnchorElement>>('fold');

  #intent: 'unfold' | 'fold' | null = null;

  readonly filters = computed(() =>
    MAGNITUDE_FILTERS.map((filter) => ({
      ...filter,
      count: this.quakes().filter((quake) => passes(quake, filter.min)).length,
      current: filter.value === this.filter(),
    })),
  );

  readonly visible = computed(() => {
    const min = minimumOf(this.filter());
    return this.quakes().filter((quake) => passes(quake, min));
  });

  readonly shown = computed(() =>
    this.unfolded() ? this.visible() : this.visible().slice(0, LATEST),
  );
  readonly folds = computed(() => this.visible().length > LATEST);

  /** Grouped by UTC day, the way a station logbook turns the page at midnight. */
  readonly days = computed(() => {
    const days = new Map<string, { day: number; rows: Row[] }>();
    for (const quake of this.shown()) {
      const key = new Date(quake.time).toISOString().slice(0, 10);
      const day = days.get(key) ?? { day: quake.time, rows: [] };
      day.rows.push(toRow(quake));
      days.set(key, day);
    }
    return [...days.values()];
  });

  readonly hasNegativeDepth = computed(() =>
    this.shown().some((quake) => (quake.location.depthKm ?? 0) < 0),
  );

  readonly latest = LATEST;

  constructor() {
    effect(() => {
      const unfolded = this.unfolded();
      untracked(() => this.#settle(unfolded));
    });
  }

  protected toggle(event: MouseEvent): void {
    // A modified click opens a tab and leaves this list as it is.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    this.#intent = this.unfolded() ? 'fold' : 'unfold';
  }

  /** After the fold link, the reader carries on where they were: at the first row it added, or at the link. */
  #settle(unfolded: boolean): void {
    const intent = this.#intent;
    this.#intent = null;
    if (intent === 'unfold' && unfolded) {
      afterNextRender(() => this.#focus(this.shown()[LATEST]?.id), { injector: this.#injector });
    } else if (intent === 'fold' && !unfolded) {
      afterNextRender(() => this.fold()?.nativeElement.scrollIntoView({ block: 'center' }), {
        injector: this.#injector,
      });
    }
  }

  #focus(id: string | undefined): void {
    this.places()
      .find((place) => place.nativeElement.dataset['id'] === id)
      ?.nativeElement.focus();
  }
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
