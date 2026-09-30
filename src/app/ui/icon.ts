import { Component, computed, input } from '@angular/core';
import { ICONS, type IconName } from './icons';

/**
 * An icon drawn inline as SVG, sized and coloured by the text around it, so
 * it renders on the server like any other markup and needs no icon font.
 *
 * Decorative unless given a `label`. Next to a word it only repeats the word,
 * and a screen reader should hear the word once.
 */
@Component({
  selector: 'ui-icon',
  template: `
    <svg
      viewBox="0 0 16 16"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() ?? null"
      [attr.aria-hidden]="label() ? null : 'true'"
      focusable="false"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      flex: none;
      width: 1em;
      height: 1em;
      vertical-align: -0.125em;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    /* In grid units, so the line thickens with the text around it. */
    path {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.7;
      stroke-linecap: square;
      stroke-linejoin: miter;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly label = input<string>();

  protected readonly path = computed(() => ICONS[this.name()]);
}
