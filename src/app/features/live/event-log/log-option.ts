import { I18nPluralPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { FacetOption } from './facets';

/**
 * One option of a facet: a link to the view it makes, with the count that view
 * would hold. An option that would empty the list is text rather than a link,
 * and reads as such.
 */
@Component({
  selector: 'fl-log-option',
  imports: [RouterLink, I18nPluralPipe],
  template: `
    @let choice = option();
    @if (choice.count || choice.current) {
      <a
        class="option"
        [routerLink]="[]"
        [queryParams]="choice.params"
        [attr.aria-current]="choice.current ? 'true' : null"
        (click)="chosen.emit()"
      >
        <span class="label"
          >{{ choice.label }}
          @if (choice.hint; as hint) {
            <small>{{ hint }}</small>
          }
        </span>
        &ngsp;<span class="leader" aria-hidden="true"></span>
        <span class="count mono"
          >{{ choice.count
          }}<span class="visually-hidden">&ngsp;{{ choice.count | i18nPlural: events }}</span></span
        >
      </a>
    } @else {
      <span class="option option--none">
        <span class="label"
          >{{ choice.label }}
          @if (choice.hint; as hint) {
            <small>{{ hint }}</small>
          }
        </span>
        &ngsp;<span class="leader" aria-hidden="true"></span>
        <span class="count mono">0<span class="visually-hidden">&ngsp;events</span></span>
      </span>
    }
  `,
  styleUrl: './log-option.css',
})
export class LogOption {
  readonly option = input.required<FacetOption>();
  /** After a click on the link, for a container that should close behind it. */
  readonly chosen = output();

  protected readonly events = { '=1': 'event', other: 'events' };
}
