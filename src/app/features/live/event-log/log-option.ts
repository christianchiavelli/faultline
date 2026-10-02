import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { FacetOption } from './facets';

/**
 * One option of a facet: a link to the view it makes, with the count that view
 * would hold. An option that would empty the list is text rather than a link,
 * and reads as such.
 */
@Component({
  selector: 'fl-log-option',
  imports: [RouterLink],
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
          >{{ choice.count }}<span class="visually-hidden">&ngsp;{{ unit() }}</span></span
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
        <span class="count mono"
          >{{ choice.count }}<span class="visually-hidden">&ngsp;{{ unit() }}</span></span
        >
      </span>
    }
  `,
  styleUrl: './log-option.css',
})
export class LogOption {
  readonly option = input.required<FacetOption>();
  /** After a click on the link, for a container that should close behind it. */
  readonly chosen = output();

  /**
   * The count's unit, read out after it. Worded here, not by an ICU in the
   * template: options repeat with the same server state, which hydration
   * shares between them, and an ICU takes its case out of that state, leaving
   * none for the next option.
   */
  protected readonly unit = computed(() =>
    this.option().count === 1
      ? $localize`:read out after the count of a filter option, exactly one:event`
      : $localize`:read out after the count of a filter option, any but one:events`,
  );
}
