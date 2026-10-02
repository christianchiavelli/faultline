import { DecimalPipe } from '@angular/common';
import { Component, LOCALE_ID, computed, inject, input } from '@angular/core';
import { regionName } from '@core/words/domain';
import { expectedPerDay } from '@shared/domain/magnitude';
import { COMPLETE_WORLDWIDE_FROM } from '@shared/domain/network';
import type { QuakeSummary } from '@shared/domain/quake';
import { formatDecimal } from '@ui/numbers';
import { capitalise } from '@ui/text';
import { STEP, distribution, type Bin } from './distribution';

@Component({
  selector: 'fl-magnitude-chart',
  imports: [DecimalPipe],
  templateUrl: './magnitude-chart.html',
  styleUrl: './magnitude-chart.css',
})
export class MagnitudeChart {
  readonly quakes = input.required<readonly QuakeSummary[]>();

  readonly #locale = inject(LOCALE_ID);
  readonly #list = new Intl.ListFormat(this.#locale, { type: 'conjunction' });

  protected readonly chart = computed(() => distribution(this.quakes()));
  protected readonly bars = computed(() => this.chart().bins.filter((bin) => bin.count > 0));
  protected readonly labelled = computed(() => this.chart().bins.filter((bin) => bin.labelled));

  protected readonly regions = computed(() => {
    const dense = this.chart().dense;
    return dense ? capitalise(this.#list.format(dense.regions.map(regionName))) : null;
  });

  protected readonly gapShape = computed(() => {
    const { x1, y1, x2, y2 } = this.chart().gap;
    return `polygon(${x1}% ${y1}%, ${x2}% ${y2}%, ${x2}% 100%, ${x1}% 100%)`;
  });

  protected readonly complete = this.magnitude(COMPLETE_WORLDWIDE_FROM);
  protected readonly fivesADay = expectedPerDay(5, 6);

  /** Magnitudes below zero are real, and written with a minus sign rather than a hyphen. */
  protected magnitude(value: number): string {
    return formatDecimal(value, this.#locale, '1.0-1');
  }

  protected range(bin: Bin): string {
    const from = this.magnitude(bin.from);
    const to = this.magnitude(bin.from + STEP);
    return $localize`:a bin of the magnitude chart, as in M2.5 to 3, in its table:M${from}:from: to ${to}:to:`;
  }

  /** Two significant figures: a rate from a law, not a count. */
  protected roughly(value: number): number {
    return Number(value.toPrecision(2));
  }
}
