import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'fl-not-found-page',
  imports: [RouterLink],
  template: `
    <article class="page gone">
      <p class="eyebrow">Error 404</p>
      <h1 class="title">Nothing recorded here</h1>
      <p class="lede">The trace runs flat at this address.</p>
      <p><a routerLink="/">Back to the live record</a></p>
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
