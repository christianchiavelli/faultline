import { DatePipe, PercentPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, RESPONSE_INIT, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { recentQuakesResource } from '@core/api/quakes';
import { Clock } from '@core/clock';
import { pollWhileVisible } from '@core/poll';
import { magnitudeScale } from '@shared/domain/magnitude';
import { summarise } from '@shared/domain/summary';
import { AgoPipe } from '@ui/ago.pipe';
import { capitalise } from '@ui/text';
import { WorldChart } from '../common/world-chart/world-chart';
import { ExportButton } from '../export/export-button';
import { EventLog, parseMagnitudeFilter } from './event-log/event-log';
import { Helicorder } from './helicorder/helicorder';
import { MagnitudeChart } from './magnitude-chart/magnitude-chart';

const FEED_REFRESH_MS = 60_000;

/**
 * The USGS regenerates the feed every minute. Five minutes without a new one
 * means something upstream is behind, whatever the BFF's cache thinks.
 */
const FEED_LATE_MS = 5 * 60_000;

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
  ],
  templateUrl: './live-page.html',
  styleUrl: './live-page.css',
})
export class LivePage {
  /** `?min=` from the URL, bound by the router. The filter lives in the address bar, not in a store. */
  readonly min = input<string>();
  /** `?rows=all` unfolds the log past its latest events, in the address bar for the same reason. */
  readonly rows = input<string>();

  protected readonly now = inject(Clock).now;
  protected readonly recent = recentQuakesResource(() => 'day');

  protected readonly feed = computed(() => (this.recent.hasValue() ? this.recent.value() : null));
  protected readonly late = computed(() => {
    const feed = this.feed();
    return !!feed && (feed.stale || this.now() - feed.generatedAt > FEED_LATE_MS);
  });
  protected readonly filter = computed(() => parseMagnitudeFilter(this.min()));
  protected readonly unfolded = computed(() => this.rows() === 'all');
  protected readonly summary = computed(() => summarise(this.feed()?.quakes ?? []));

  protected readonly largest = computed(() => {
    const largest = this.summary().largest;
    if (!largest?.magnitude) return null;
    return {
      quake: largest,
      place: largest.place ? capitalise(largest.place) : 'Location not described',
      value: largest.magnitude.value.toFixed(1),
      scale: magnitudeScale(largest.magnitude.type),
    };
  });

  /** The kinds that are not earthquakes, e.g. "7 explosions", for the count's footnote. */
  protected readonly otherKinds = computed(() => {
    const counts = new Map<string, number>();
    for (const quake of this.feed()?.quakes ?? []) {
      if (quake.kind !== 'earthquake') counts.set(quake.kind, (counts.get(quake.kind) ?? 0) + 1);
    }
    return [...counts].map(([kind, count]) => `${count} ${count === 1 ? kind : pluralise(kind)}`);
  });

  constructor() {
    pollWhileVisible(this.recent, FEED_REFRESH_MS);

    // A page rendered without its data says so in its status, so monitors see the outage.
    const response = inject(RESPONSE_INIT, { optional: true });
    effect(() => {
      const error = this.recent.error();
      if (response && error instanceof HttpErrorResponse) response.status = error.status;
    });
  }
}

function pluralise(kind: string): string {
  return kind.endsWith('s') ? kind : `${kind}s`;
}
