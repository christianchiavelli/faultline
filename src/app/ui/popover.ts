import { Component, input, viewChild, type ElementRef } from '@angular/core';

let nextId = 0;

/**
 * A panel that opens from a button, on the platform's own popover: a click
 * outside or Escape closes it, focus goes back to the button when it closes
 * from inside, and the button works before the page has hydrated. The panel
 * hangs from its button, anchored in CSS, and turns to stay on the screen.
 *
 * The button shows what is projected as `uiPopoverTrigger` and is named by
 * `label`; the panel is a group named by its `heading`.
 */
@Component({
  selector: 'ui-popover',
  template: `
    <button type="button" class="trigger" [attr.popovertarget]="id" [attr.aria-label]="label()">
      <ng-content select="[uiPopoverTrigger]" />
    </button>
    <div #panel popover class="panel" role="group" [id]="id" [attr.aria-labelledby]="headingId">
      <p class="eyebrow" [id]="headingId">{{ heading() }}</p>
      <ng-content />
    </div>
  `,
  styleUrl: './popover.css',
  // Its own anchor name, so two on one page each hang from their own button.
  host: { '[style.--anchor]': 'anchor' },
})
export class Popover {
  readonly label = input.required<string>();
  readonly heading = input.required<string>();

  readonly #id = nextId++;
  protected readonly id = `ui-popover-${this.#id}`;
  protected readonly headingId = `${this.id}-heading`;
  protected readonly anchor = `--${this.id}`;
  // A TypeScript `private`: signal queries cannot be ES private fields.
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  /** For a choice made inside: the panel closes behind it, and the focus goes back to the button. */
  close(): void {
    this.panel().nativeElement.hidePopover();
  }
}
