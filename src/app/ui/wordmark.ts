import { Component } from '@angular/core';

/**
 * The line breaks and steps down, the way a fault offsets everything that
 * crosses it. The word does the same, a hair: "line" sits lower than "Fault".
 */
@Component({
  selector: 'ui-wordmark',
  template: `
    <svg class="mark" viewBox="0 0 30 16" aria-hidden="true" focusable="false">
      <path class="mark__ink" d="M1 5.5h12.5M16.5 10.5H29" />
      <path class="mark__fault" d="M12.5 5.5l5 5" />
    </svg>
    <span class="word">Fault<span class="word__offset">line</span></span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.55em;
      font-size: var(--text-lg);
      font-weight: 760;
      font-stretch: var(--width-expanded);
      letter-spacing: -0.035em;
      line-height: 1;
    }

    .mark {
      width: 1.75em;
      height: auto;
      overflow: visible;
    }

    .mark__ink,
    .mark__fault {
      fill: none;
      stroke-width: 2.2;
      stroke-linecap: square;
    }

    .mark__ink {
      stroke: currentColor;
    }

    .mark__fault {
      stroke: var(--content-accent);
    }

    .word__offset {
      display: inline-block;
      translate: 0 0.09em;
    }
  `,
})
export class Wordmark {}
