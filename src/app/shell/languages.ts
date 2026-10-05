import { Component } from '@angular/core';
import { pageInEveryLanguage } from '@core/languages';

/**
 * The languages, the current one marked: "EN · PT". The other is a plain link
 * to the same page in it, a full load, since each language is a build of its
 * own. Its name goes on in its own language, for the reader who reads that
 * one, after the code it shows: a reader who speaks to the page says "PT".
 */
@Component({
  selector: 'fl-languages',
  template: `
    @for (language of languages(); track language.locale; let last = $last) {
      @if (language.current) {
        <span class="current" aria-current="true" [attr.lang]="language.locale">{{
          language.short
        }}</span>
      } @else {
        <a [href]="language.href" [attr.hreflang]="language.hreflang" [attr.lang]="language.locale"
          >{{ language.short }}<span class="visually-hidden">, {{ language.readIn }}</span></a
        >
      }
      @if (!last) {
        <span class="separator" aria-hidden="true">·</span>
      }
    }
  `,
  styleUrl: './languages.css',
})
export class Languages {
  protected readonly languages = pageInEveryLanguage();
}
