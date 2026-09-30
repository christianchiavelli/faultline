import { I18nPluralPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '@ui/icon';
import { describeFloor, filtersOn, type Facet } from './facets';
import { clearFilters, isFiltered, logParams, type LogQuery } from './log-query';

/**
 * What the filters leave of the day: the count first, then the magnitude floor
 * it is of, each filter in force with the way to take it off, and the way back
 * to the whole day. All links, so each works before the page has hydrated.
 */
@Component({
  selector: 'fl-log-summary',
  imports: [RouterLink, I18nPluralPipe, Icon],
  template: `
    <p class="tally">
      <span class="mono tally__shown">{{ shown() }}</span> of
      <span class="mono">{{ total() }}</span> {{ total() | i18nPlural: events }}
      <span class="tally__floor">· {{ floor() }}</span>
    </p>
    @if (filters().length) {
      <ul class="chips" aria-label="Filters on">
        @for (filter of filters(); track filter.key) {
          <li>
            <a class="chip" [routerLink]="[]" [queryParams]="filter.params"
              ><span class="visually-hidden">Remove&ngsp;</span>{{ filter.label
              }}<ui-icon name="close"
            /></a>
          </li>
        }
      </ul>
    }
    @if (clearParams(); as params) {
      <a class="clear" [routerLink]="[]" [queryParams]="params">Clear filters</a>
    }
  `,
  styleUrl: './log-summary.css',
})
export class LogSummary {
  readonly query = input.required<LogQuery>();
  readonly facets = input.required<readonly Facet[]>();
  /** How many events the list holds with the filters in force. */
  readonly shown = input.required<number>();
  /** How many the day holds. */
  readonly total = input.required<number>();

  protected readonly floor = computed(() => describeFloor(this.facets()));
  protected readonly filters = computed(() => filtersOn(this.facets(), this.query()));
  protected readonly clearParams = computed(() =>
    isFiltered(this.query()) ? logParams(clearFilters(this.query())) : null,
  );
  protected readonly events = { '=1': 'event', other: 'events' };
}
