import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { expectedPerDay } from '@shared/domain/magnitude';
import { COMPLETE_WORLDWIDE_FROM } from '@shared/domain/network';
import type { QuakeSummary } from '@shared/domain/quake';
import { capitalise } from '@ui/text';
import { STEP, distribution, type Bin } from './distribution';

const LIST = new Intl.ListFormat('en-GB', { type: 'conjunction' });

@Component({
  selector: 'fl-magnitude-chart',
  imports: [DecimalPipe],
  templateUrl: './magnitude-chart.html',
  styleUrl: './magnitude-chart.css',
})
export class MagnitudeChart {
  readonly quakes = input.required<readonly QuakeSummary[]>();

  protected readonly chart = computed(() => distribution(this.quakes()));
  protected readonly bars = computed(() => this.chart().bins.filter((bin) => bin.count > 0));
  protected readonly labelled = computed(() => this.chart().bins.filter((bin) => bin.labelled));

  protected readonly regions = computed(() => {
    const dense = this.chart().dense;
    return dense ? capitalise(LIST.format(dense.regions)) : null;
  });

  protected readonly gapShape = computed(() => {
    const { x1, y1, x2, y2 } = this.chart().gap;
    return `polygon(${x1}% ${y1}%, ${x2}% ${y2}%, ${x2}% 100%, ${x1}% 100%)`;
  });

  protected readonly complete = COMPLETE_WORLDWIDE_FROM;
  protected readonly fivesADay = expectedPerDay(5, 6);

  /** Magnitudes below zero are real, and written with a minus sign rather than a hyphen. */
  protected signed(value: number): string {
    return String(value).replace('-', '−');
  }

  protected range(bin: Bin): string {
    return `M${this.signed(bin.from)} to ${this.signed(bin.from + STEP)}`;
  }

  /** Two significant figures: a rate from a law, not a count. */
  protected roughly(value: number): number {
    return Number(value.toPrecision(2));
  }
}
