import { DatePipe, I18nPluralPipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { magnitudeScale } from '@shared/domain/magnitude';
import { splitPlace } from '@shared/domain/place';
import { EARTHQUAKE_KIND, isNotable, type QuakeSummary } from '@shared/domain/quake';
import { AgoPipe } from '@ui/ago.pipe';
import { Highlight } from '@ui/highlight';
import { Icon } from '@ui/icon';
import { capitalise } from '@ui/text';
import { dotRadius } from '../../common/world-chart/world-chart';
import { quakeLinkState, type QuakeLinkState } from '../../quake/quake-link';
import { facetsOf, matches, sortEntries, toEntries } from './facets';
import { LogFacets } from './log-facets';
import { LogFilters } from './log-filters';
import { LogSearch } from './log-search';
import { LogSummary } from './log-summary';
import {
  LOG_ORDERS,
  clearFilters,
  isFiltered,
  logParams,
  type LogOrder,
  type LogQuery,
} from './log-query';

/** How the fold and the caption name the order: "the latest 10", "largest first". */
const ORDER_WORDS: Record<LogOrder, { readonly few: string; readonly first: string }> = {
  newest: { few: 'latest', first: 'newest first' },
  largest: { few: 'largest', first: 'largest first' },
  deepest: { few: 'deepest', first: 'deepest first' },
};

/**
 * About a laptop screen of the log. The rest is one link away, in the address
 * bar like the filter, so it can be shared and undone with Back.
 */
export const LATEST = 10;

/** How long rows just shown stay tinted, so the eye finds where they went. */
const FRESH_MS = 4_000;

@Component({
  selector: 'fl-event-log',
  imports: [
    RouterLink,
    DatePipe,
    I18nPluralPipe,
    AgoPipe,
    Highlight,
    Icon,
    LogFacets,
    LogFilters,
    LogSearch,
    LogSummary,
  ],
  templateUrl: './event-log.html',
  styleUrl: './event-log.css',
  // The tint's fade runs as long as the rows stay fresh: one number for both.
  host: { '[style.--fresh-for]': 'freshFor' },
})
export class EventLog {
  readonly quakes = input.required<readonly QuakeSummary[]>();
  readonly query = input.required<LogQuery>();
  readonly now = input.required<number>();

  protected readonly unfolded = computed(() => this.query().unfolded);

  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #injector = inject(Injector);
  readonly #destroyRef = inject(DestroyRef);
  private readonly places = viewChildren<ElementRef<HTMLAnchorElement>>('place');
  private readonly fold = viewChild<ElementRef<HTMLAnchorElement>>('fold');

  /**
   * A live list must not move under its reader. Every event they have been
   * shown is seen; one that arrives while they can see the log is held above
   * it until they ask for it.
   */
  readonly #seen = new Set<string>();
  readonly #held = signal<ReadonlySet<string>>(new Set());
  readonly #fresh = signal<ReadonlySet<string>>(new Set());
  /** On screen, or scrolled past: anywhere a new row would push what the reader sees. */
  readonly #reached = signal(false);
  #intent: 'unfold' | 'fold' | null = null;
  #freshTimer: ReturnType<typeof setTimeout> | undefined;

  readonly #listed = computed(() => {
    const held = this.#held();
    return held.size ? this.quakes().filter((quake) => !held.has(quake.id)) : this.quakes();
  });

  readonly #entries = computed(() => toEntries(this.#listed()));

  readonly facets = computed(() => facetsOf(this.#entries(), this.query()));
  protected readonly filtered = computed(() => isFiltered(this.query()));
  protected readonly search = computed(() => this.query().search);
  protected readonly total = computed(() => this.#listed().length);
  protected readonly clearParams = computed(() => logParams(clearFilters(this.query())));

  /** The fold link's address: the same view, folded the other way. */
  protected readonly foldParams = computed(() =>
    logParams({ ...this.query(), unfolded: !this.query().unfolded }),
  );

  /** The filters alone, as text: unfolding the list is not a new filter. */
  readonly #filters = computed(() => JSON.stringify({ ...this.query(), unfolded: false }));

  readonly visible = computed(() => {
    const query = this.query();
    return sortEntries(
      this.#entries().filter((entry) => matches(entry, query)),
      query.order,
    ).map((entry) => entry.quake);
  });

  protected readonly order = computed(() => this.query().order);
  protected readonly orderWords = computed(() => ORDER_WORDS[this.order()]);

  /** Each sortable column's link: the same view, in that column's order. */
  protected readonly sorts = computed(() => {
    const query = this.query();
    return Object.fromEntries(
      LOG_ORDERS.map((order) => [order, logParams({ ...query, order })]),
    ) as Record<LogOrder, ReturnType<typeof logParams>>;
  });

  /** Held events these filters would show. */
  readonly waiting = computed(() => {
    const held = this.#held();
    const query = this.query();
    return toEntries(this.quakes().filter((quake) => held.has(quake.id))).filter((entry) =>
      matches(entry, query),
    ).length;
  });

  /**
   * What a screen reader hears after a filter changes: the new count. It
   * follows the filters and not the feed, or every minute's delivery would
   * interrupt the reader with a count they did not ask for.
   */
  protected readonly announcement = computed(() => {
    this.#filters();
    return untracked(() => {
      const count = this.visible().length;
      return `${count} ${count === 1 ? 'event' : 'events'}`;
    });
  });

  readonly shown = computed(() =>
    this.unfolded() ? this.visible() : this.visible().slice(0, LATEST),
  );
  readonly folds = computed(() => this.visible().length > LATEST);

  /**
   * Grouped by UTC day, the way a station logbook turns the page at midnight.
   * Sorted by size or depth, the days would interleave, so the list is one
   * group without a heading.
   */
  readonly days = computed(() => {
    const fresh = this.#fresh();
    if (this.order() !== 'newest') {
      const rows = this.shown().map((quake) => toRow(quake, fresh.has(quake.id)));
      return rows.length ? [{ day: null, rows }] : [];
    }
    const days = new Map<string, { day: number | null; rows: Row[] }>();
    for (const quake of this.shown()) {
      const key = new Date(quake.time).toISOString().slice(0, 10);
      const day = days.get(key) ?? { day: quake.time, rows: [] };
      day.rows.push(toRow(quake, fresh.has(quake.id)));
      days.set(key, day);
    }
    return [...days.values()];
  });

  readonly hasNegativeDepth = computed(() =>
    this.shown().some((quake) => (quake.location.depthKm ?? 0) < 0),
  );

  readonly latest = LATEST;
  readonly events = { '=1': 'event', other: 'events' };
  protected readonly freshFor = `${FRESH_MS}ms`;

  constructor() {
    effect(() => {
      const quakes = this.quakes();
      untracked(() => this.#receive(quakes));
    });
    // A new filter redraws the whole list, so whatever was held comes in with it.
    effect(() => {
      this.#filters();
      untracked(() => this.#takeHeld());
    });
    effect(() => {
      const unfolded = this.unfolded();
      untracked(() => this.#settle(unfolded));
    });
    afterNextRender(() => this.#watchReach());
    this.#destroyRef.onDestroy(() => clearTimeout(this.#freshTimer));
  }

  protected showNew(): void {
    const shown = this.#takeHeld();
    this.#fresh.set(shown);
    clearTimeout(this.#freshTimer);
    this.#freshTimer = setTimeout(() => this.#fresh.set(new Set()), FRESH_MS);
    // The button leaves with the events it held, so focus goes to the first of them.
    afterNextRender(() => this.#focus(this.shown().find((quake) => shown.has(quake.id))?.id), {
      injector: this.#injector,
    });
  }

  protected toggle(event: MouseEvent): void {
    // A modified click opens a tab and leaves this list as it is.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    this.#intent = this.unfolded() ? 'fold' : 'unfold';
  }

  #receive(quakes: readonly QuakeSummary[]): void {
    const held = this.#held();
    const arrived = quakes.filter((quake) => !this.#seen.has(quake.id) && !held.has(quake.id));
    if (!arrived.length) return;
    // The first delivery is the list itself; later ones wait if they would land in view.
    if (this.#seen.size && this.#reached()) {
      this.#held.set(new Set([...held, ...arrived.map((quake) => quake.id)]));
    } else {
      for (const quake of arrived) this.#seen.add(quake.id);
    }
  }

  #takeHeld(): ReadonlySet<string> {
    const held = this.#held();
    if (!held.size) return held;
    for (const id of held) this.#seen.add(id);
    this.#held.set(new Set());
    return held;
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

  #watchReach(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries.at(-1);
      if (entry) {
        const bottom = entry.rootBounds?.height ?? window.innerHeight;
        this.#reached.set(entry.boundingClientRect.top < bottom);
      }
    });
    observer.observe(this.#host.nativeElement);
    this.#destroyRef.onDestroy(() => observer.disconnect());
  }
}

interface Row {
  readonly id: string;
  readonly time: number;
  readonly iso: string;
  readonly magnitude: string | null;
  readonly scale: { readonly code: string; readonly title: string } | null;
  /** The map's dot for this magnitude, in pixels across. */
  readonly dot: number;
  readonly notable: boolean;
  /** The locality, or the whole place name when the USGS gives only a region. */
  readonly where: string;
  readonly region: string | null;
  /** The region again, after the locality, where a narrow screen has no column for it. */
  readonly inlineRegion: string | null;
  readonly latitude: string;
  readonly longitude: string;
  readonly kind: string | null;
  readonly depth: string | null;
  readonly depthTitle: string | null;
  /** "35.0 km deep", or "1.2 km above sea level", where no heading says what the number is. */
  readonly depthPhrase: string | null;
  readonly reviewed: boolean;
  readonly fresh: boolean;
  /** What the row's link hands its event's page, so the page opens on it. */
  readonly link: QuakeLinkState;
}

function toRow(quake: QuakeSummary, fresh: boolean): Row {
  const scale = quake.magnitude ? magnitudeScale(quake.magnitude.type) : null;
  const { latitude, longitude, depthKm: depth } = quake.location;
  const { locality, region } = splitPlace(quake.place);
  const where = locality ?? quake.place;
  return {
    id: quake.id,
    time: quake.time,
    iso: new Date(quake.time).toISOString(),
    magnitude: quake.magnitude ? quake.magnitude.value.toFixed(1) : null,
    scale: scale ? { code: scale.code, title: `${scale.name}. ${scale.summary}` } : null,
    dot: dotSize(quake.magnitude?.value ?? null),
    notable: isNotable(quake),
    where: where ? capitalise(where) : 'Location not described',
    region: region ? capitalise(region) : null,
    inlineRegion: locality && region ? capitalise(region) : null,
    latitude: degrees(latitude, 'N', 'S'),
    longitude: degrees(longitude, 'E', 'W'),
    kind: quake.kind === EARTHQUAKE_KIND ? null : quake.kind,
    depth: depth === null ? null : depth.toFixed(1).replace('-', '−'),
    depthTitle:
      depth !== null && depth < 0 ? `${Math.abs(depth).toFixed(1)} km above sea level` : null,
    depthPhrase:
      depth === null
        ? null
        : depth < 0
          ? `${Math.abs(depth).toFixed(1)} km above sea level`
          : `${depth.toFixed(1)} km deep`,
    reviewed: quake.review === 'reviewed',
    fresh,
    link: quakeLinkState(quake),
  };
}

/** The map's dot, grown by the same law and held to what fits beside a line of text. */
function dotSize(magnitude: number | null): number {
  return Math.round(Math.min(16, Math.max(4, dotRadius(magnitude))) * 10) / 10;
}

/** "52.32° N": to a hundredth of a degree, about a kilometre, finer than most locations are known. */
function degrees(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(2)}° ${value < 0 ? negative : positive}`;
}
