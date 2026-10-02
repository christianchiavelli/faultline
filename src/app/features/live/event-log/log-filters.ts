import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Icon } from '@ui/icon';
import type { Facet } from './facets';
import {
  DEFAULT_LOG_QUERY,
  LOG_ORDERS,
  logParams,
  type LogOrder,
  type LogQuery,
} from './log-query';
import { LogSheet } from './log-sheet';

const ORDER_LABELS: Record<LogOrder, string> = {
  newest: $localize`:an order of the log, in its menu:Newest first`,
  largest: $localize`:an order of the log, in its menu:Largest first`,
  deepest: $localize`:an order of the log, in its menu:Deepest first`,
};

/**
 * The log's filters where the screen is too narrow for their column: a button
 * to a sheet holding the same facets, and, where the table has no headings
 * left to sort from, the order as a menu.
 */
@Component({
  selector: 'fl-log-filters',
  imports: [Icon, LogSheet],
  templateUrl: './log-filters.html',
  styleUrl: './log-filters.css',
})
export class LogFilters {
  readonly query = input.required<LogQuery>();
  readonly facets = input.required<readonly Facet[]>();
  /** How many events the list holds, for the sheet's button. */
  readonly shown = input.required<number>();

  readonly #router = inject(Router);

  protected readonly open = signal(false);
  protected readonly orders = LOG_ORDERS.map((value) => ({ value, label: ORDER_LABELS[value] }));
  protected readonly order = computed(() => this.query().order);

  /** How many filters are away from their default, for the button's badge. The search shows itself. */
  protected readonly active = computed(() => {
    const { magnitude, region, depth, review, kind } = this.query();
    return [magnitude !== DEFAULT_LOG_QUERY.magnitude, region, depth, review, kind].filter(Boolean)
      .length;
  });

  protected sortBy(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const order = LOG_ORDERS.find((candidate) => candidate === value);
    if (order) {
      void this.#router.navigate([], { queryParams: logParams({ ...this.query(), order }) });
    }
  }
}
