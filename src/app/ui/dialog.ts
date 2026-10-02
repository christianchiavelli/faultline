import {
  Component,
  afterNextRender,
  afterRenderEffect,
  input,
  model,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { Icon } from './icon';

let nextId = 0;

/**
 * A modal dialog on the platform's own `<dialog>`. The page behind is inert,
 * Escape and a click outside close it, focus moves in when it opens and back
 * to whatever opened it when it closes: none of that is reimplemented here.
 *
 * The lede under the heading is the dialog's description, read out with its
 * name when it opens. The body scrolls; the footer (`uiDialogFooter`) stays in
 * reach, pinned to the bottom of the screen on a phone.
 */
@Component({
  selector: 'ui-dialog',
  imports: [Icon],
  template: `
    <dialog
      #dialog
      class="dialog"
      [class.dialog--sheet]="sheet()"
      closedby="any"
      [attr.aria-labelledby]="headingId"
      [attr.aria-describedby]="lede() ? ledeId : null"
      (close)="open.set(false)"
    >
      <header class="head">
        <div>
          @if (eyebrow(); as eyebrow) {
            <p class="eyebrow">{{ eyebrow }}</p>
          }
          <h2 class="heading" [id]="headingId">{{ heading() }}</h2>
          @if (lede(); as lede) {
            <p class="lede" [id]="ledeId">{{ lede }}</p>
          }
        </div>
        <button
          type="button"
          class="close"
          aria-label="Close"
          i18n-aria-label="button that closes a dialog"
          (click)="open.set(false)"
        >
          <ui-icon name="close" />
        </button>
      </header>
      <div class="body"><ng-content /></div>
      <footer class="foot"><ng-content select="[uiDialogFooter]" /></footer>
    </dialog>
  `,
  styleUrl: './dialog.css',
})
export class Dialog {
  readonly open = model(false);
  readonly heading = input.required<string>();
  readonly eyebrow = input<string>();
  readonly lede = input<string>();
  /** On a phone, rise from the bottom and leave the top of the page in view, for a panel of options. */
  readonly sheet = input(false);

  readonly #id = nextId++;
  protected readonly headingId = `ui-dialog-${this.#id}-heading`;
  protected readonly ledeId = `ui-dialog-${this.#id}-lede`;
  // A TypeScript `private`: signal queries cannot be ES private fields.
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // After render, so never on the server, which has no `showModal`.
    afterRenderEffect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) dialog.showModal();
      else if (!this.open() && dialog.open) dialog.close();
    });

    // `closedby="any"` closes the dialog on a click outside it, except in
    // Safari, which does not support it yet. There, this does the same: a press
    // that starts and ends on the backdrop, so a text selection dragged out of
    // the dialog does not close it. Keyboards have Escape either way.
    afterNextRender(() => {
      if ('closedBy' in HTMLDialogElement.prototype) return;
      const dialog = this.dialog().nativeElement;
      let pressedOnBackdrop = false;
      dialog.addEventListener('pointerdown', (event) => {
        pressedOnBackdrop = event.target === dialog;
      });
      dialog.addEventListener('click', (event) => {
        if (pressedOnBackdrop && event.target === dialog) this.open.set(false);
      });
    });
  }
}
