import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'fl-not-found-page',
  imports: [RouterLink],
  template: `
    <article class="page gone">
      <p class="eyebrow" i18n="the error a page that does not exist answers">Error 404</p>
      <h1 class="title" i18n="heading of a page that does not exist">Nothing recorded here</h1>
      <p class="lede" i18n="what a page that does not exist says">
        The trace runs flat at this address.
      </p>
      <p>
        <a routerLink="/" i18n="link from an error page to the live page"
          >Back to the live record</a
        >
      </p>
    </article>
  `,
  styles: `
    .gone {
      display: grid;
      gap: var(--space-4);
      padding-block: var(--space-16);
    }
  `,
})
export class NotFoundPage {}
