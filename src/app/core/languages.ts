import { DOCUMENT } from '@angular/common';
import { LOCALE_ID, computed, effect, inject, type Signal } from '@angular/core';
import { Router } from '@angular/router';

export interface Language {
  /** The locale it is built in, as `angular.json` names it: its pages' `lang`. */
  readonly locale: string;
  /**
   * The readers it is for, as search engines read `hreflang`: the whole
   * language, since it is the only build in it, not one country's readers.
   */
  readonly hreflang: string;
  /** Where its pages live: the `subPath` of its build in `angular.json`. */
  readonly prefix: string;
  readonly short: string;
  /** The way to it, in its own words: a reader who cannot read this page can read that. */
  readonly readIn: string;
}

/**
 * The languages the app is built in, each under its own path, as `i18n` in
 * `angular.json` lays them out: British English at the root, Brazilian
 * Portuguese under `/pt`. Every page has an address in each, and nobody is
 * sent from one to the other.
 */
const LANGUAGES: readonly Language[] = [
  { locale: 'en-GB', hreflang: 'en', prefix: '', short: 'EN', readIn: 'Read in English' },
  { locale: 'pt-BR', hreflang: 'pt', prefix: '/pt', short: 'PT', readIn: 'Ler em português' },
];

export interface PageInLanguage extends Language {
  readonly current: boolean;
  /** The page the reader is on, in this language: the same path and the same filters. */
  readonly href: string;
}

/** The page the reader is on, in every language, kept to the page as they move. Needs an injection context. */
export function pageInEveryLanguage(): Signal<readonly PageInLanguage[]> {
  const router = inject(Router);
  // The language is what counts, whichever country's conventions the build follows.
  const current = inject(LOCALE_ID).split('-')[0];
  return computed(() => {
    router.lastSuccessfulNavigation();
    const page = router.url;
    return LANGUAGES.map((language) => ({
      ...language,
      current: language.hreflang === current,
      href: `${language.prefix}${page}`,
    }));
  });
}

/**
 * Tells search engines where each page is in the other language, the English
 * one standing for any language not built: `<link rel="alternate">` in the
 * head, with absolute addresses as they require. Rendered with the page on
 * the server, and kept to it in the browser. Needs an injection context.
 */
export function linkAlternateLanguages(): void {
  const document = inject(DOCUMENT);
  const pages = pageInEveryLanguage();

  // The server's DOM has only the classic node methods: no append() or remove(), no reflected properties.
  effect(() => {
    const { origin } = document.location;
    for (const link of document.head.querySelectorAll('link[rel="alternate"][hreflang]')) {
      document.head.removeChild(link);
    }
    const alternates = pages().map(({ hreflang, href }) => ({ hreflang, href }));
    const english = alternates.find(({ hreflang }) => hreflang === 'en');
    if (english) alternates.push({ hreflang: 'x-default', href: english.href });

    for (const { hreflang, href } of alternates) {
      const link = document.createElement('link');
      link.setAttribute('rel', 'alternate');
      link.setAttribute('hreflang', hreflang);
      link.setAttribute('href', new URL(href, origin).href);
      document.head.appendChild(link);
    }
  });
}
