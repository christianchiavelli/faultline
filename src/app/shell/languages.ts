import { Component } from '@angular/core';
import { pageInEveryLanguage } from '@core/languages';

/**
 * The languages, the current one marked: "EN · PT". The other is a plain link
 * to the same page in it, a full load, since each language is a build of its
 * own; it is named in its own language, for the reader who reads that one.
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
        <a
          [href]="language.href"
          [attr.hreflang]="language.hreflang"
          [attr.lang]="language.locale"
          [attr.aria-label]="language.readIn"
          >{{ language.short }}</a
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
