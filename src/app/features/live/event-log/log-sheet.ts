import { Component, computed, input, model } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Dialog } from '@ui/dialog';
import type { Facet } from './facets';
import { LogFacets } from './log-facets';
import { clearFilters, isFiltered, logParams, type LogQuery } from './log-query';

/**
 * The log's facets in a sheet, for a screen too narrow for their column. Its
 * own component, so that `@defer` loads it as a file of this app: a library
 * pipe used only inside a deferred block is loaded through its package's whole
 * namespace, which keeps every export of it in the first load.
 */
@Component({
  selector: 'fl-log-sheet',
  imports: [RouterLink, Dialog, LogFacets],
  template: `
    <ui-dialog
      [(open)]="open"
      heading="Filters"
      i18n-heading="heading of the sheet of the log's filters"
      [sheet]="true"
    >
      <fl-log-facets [facets]="facets()" />
      <div uiDialogFooter class="foot">
        @if (filtered()) {
          <a
            class="text-button"
            [routerLink]="[]"
            [queryParams]="clearParams()"
            i18n="link that takes every filter of the log off"
            >Clear filters</a
          >
        }
        <button
          type="button"
          class="button"
          (click)="open.set(false)"
          i18n="button that closes the sheet of filters, with how many events they leave"
        >
          {shown(), plural, =1 {Show 1 event} other {Show {{ shown() }} events}}
        </button>
      </div>
    </ui-dialog>
  `,
  styles: `
    .foot {
      display: flex;
      align-items: center;
      gap: var(--space-4);

      & .button {
        flex: 1;
        max-width: 16rem;
        margin-inline-start: auto;
        padding-block: var(--space-3);
      }
    }
  `,
})
export class LogSheet {
  readonly open = model(false);
  readonly query = input.required<LogQuery>();
  readonly facets = input.required<readonly Facet[]>();
  /** How many events the list holds with the filters in force. */
  readonly shown = input.required<number>();

  protected readonly filtered = computed(() => isFiltered(this.query()));
  protected readonly clearParams = computed(() => logParams(clearFilters(this.query())));
}
