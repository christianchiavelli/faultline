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
      [attr.viewBox]="viewBox()"
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
      fill: currentColor;
      overflow: visible;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly label = input<string>();

  readonly #icon = computed(() => ICONS[this.name()].icon);

  protected readonly viewBox = computed(() => {
    const [width, height] = this.#icon();
    return `0 0 ${width} ${height}`;
  });

  /** Duotone icons carry two paths; the solid set carries one. */
  protected readonly path = computed(() => {
    const path = this.#icon()[4];
    return Array.isArray(path) ? path.join(' ') : path;
  });
}
