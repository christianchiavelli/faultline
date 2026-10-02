import { DatePipe, PercentPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  LOCALE_ID,
  RESPONSE_INIT,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { liveQuakesResource } from '@core/api/quakes';
import { Clock } from '@core/clock';
import { countKind } from '@core/words/domain';
import { describeScale } from '@core/words/magnitude';
import { isEarthquake } from '@shared/domain/quake';
import { summarise } from '@shared/domain/summary';
import { AgoPipe } from '@ui/ago.pipe';
import { arrival } from '@ui/arrival';
import { formatDecimal } from '@ui/numbers';
import { Skeleton } from '@ui/skeleton';
import { capitalise } from '@ui/text';
import { WorldChart } from '../common/world-chart/world-chart';
import { ExportButton } from '../export/export-button';
import { quakeLinkState } from '../quake/quake-link';
import { EventLog } from './event-log/event-log';
import { parseLogQuery, toExportPreset, type LogParams } from './event-log/log-query';
import { Helicorder } from './helicorder/helicorder';
import { MagnitudeChart } from './magnitude-chart/magnitude-chart';

/**
 * The USGS regenerates the feed every minute. Five minutes without a new one
 * means something upstream is behind, whatever the BFF's cache thinks.
 */
const FEED_LATE_MS = 5 * 60_000;

/** The readouts' labels, the same over the day's values and over the lines waiting for them. */
const READOUTS = {
  events: $localize`:readout label|how many events the day held:Events`,
  largest: $localize`:readout label|the day's largest event:Largest`,
  energy: $localize`:readout label|the share of the day's energy its largest event released:Energy`,
  reviewed: $localize`:readout label|the share of the day's events a seismologist reviewed:Reviewed`,
} as const;

/** The waiting log's lines, uneven like the places they stand for. */
const LOG_ROWS = ['62%', '48%', '71%', '55%', '66%', '44%', '58%', '69%', '51%', '63%'] as const;

@Component({
  selector: 'fl-live-page',
  imports: [
    RouterLink,
    DatePipe,
    PercentPipe,
    AgoPipe,
    Helicorder,
    WorldChart,
    MagnitudeChart,
    EventLog,
    ExportButton,
    Skeleton,
  ],
  templateUrl: './live-page.html',
  styleUrl: './live-page.css',
})
export class LivePage {
  /** The log's view, from the query parameters the router binds here (see `log-query.ts`). */
  readonly mag = input<string>();
  readonly region = input<string>();
  readonly depth = input<string>();
  readonly review = input<string>();
  readonly kind = input<string>();
  readonly q = input<string>();
  readonly sort = input<string>();
  readonly rows = input<string>();

  protected readonly now = inject(Clock).now;
  readonly #locale = inject(LOCALE_ID);
  protected readonly recent = liveQuakesResource('day');

  protected readonly feed = computed(() => (this.recent.hasValue() ? this.recent.value() : null));
  /** Nothing to show but the failure: no copy of the feed at all, not even an old one. */
  protected readonly failed = computed(() => !this.feed() && !!this.recent.error());
  protected readonly arriving = arrival(this.feed);
  protected readonly late = computed(() => {
    const feed = this.feed();
    return !!feed && (feed.stale || this.now() - feed.generatedAt > FEED_LATE_MS);
  });
  // Every parameter the log reads, or this fails to compile: an unbound one would do nothing, silently.
  protected readonly query = computed(() =>
    parseLogQuery({
      mag: this.mag(),
      region: this.region(),
      depth: this.depth(),
      review: this.review(),
      kind: this.kind(),
      q: this.q(),
      sort: this.sort(),
      rows: this.rows(),
    } satisfies Record<keyof LogParams, string | undefined>),
  );
  protected readonly exportPreset = computed(() => toExportPreset(this.query()));
  protected readonly summary = computed(() => summarise(this.feed()?.quakes ?? []));

  protected readonly largest = computed(() => {
    const largest = this.summary().largest;
    if (!largest?.magnitude) return null;
    return {
      quake: largest,
      place: largest.place
        ? capitalise(largest.place)
        : $localize`:in place of an event's place name, when the USGS gives none:Location not described`,
      value: formatDecimal(largest.magnitude.value, this.#locale, '1.1-1'),
      scale: describeScale(largest.magnitude.type),
      link: quakeLinkState(largest),
    };
  });

  /** The kinds that are not earthquakes, e.g. "7 explosions", for the count's footnote. */
  protected readonly otherKinds = computed(() => {
    const counts = new Map<string, number>();
    for (const quake of this.feed()?.quakes ?? []) {
      if (!isEarthquake(quake)) counts.set(quake.kind, (counts.get(quake.kind) ?? 0) + 1);
    }
    return [...counts].map(([kind, count]) => countKind(kind, count));
  });

  protected readonly readouts = READOUTS;
  protected readonly readoutLabels = Object.values(READOUTS);
  protected readonly logRows = LOG_ROWS;

  constructor() {
    // A page rendered without its data says so in its status, so monitors see the outage.
    const response = inject(RESPONSE_INIT, { optional: true });
    effect(() => {
      const error = this.recent.error();
      if (response && error instanceof HttpErrorResponse) response.status = error.status;
    });
  }
}
