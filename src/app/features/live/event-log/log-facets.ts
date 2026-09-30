import { Component, input } from '@angular/core';
import { Icon } from '@ui/icon';
import type { Facet } from './facets';
import { LogOption } from './log-option';

let nextId = 0;

/**
 * The log's filters as an index: one column per question, each option with
 * the count it would leave. Options are links, so each view has an address,
 * and they work before the page has hydrated. The long tail of regions opens
 * in a native popover, anchored in CSS, which needs no script either.
 */
@Component({
  selector: 'fl-log-facets',
  imports: [Icon, LogOption],
  templateUrl: './log-facets.html',
  styleUrl: './log-facets.css',
})
export class LogFacets {
  readonly facets = input.required<readonly Facet[]>();

  protected readonly id = `log-facets-${nextId++}`;
}
