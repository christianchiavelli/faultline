import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, REQUEST, Service, inject, signal } from '@angular/core';

/** `paper` is the light drum, `film` the photographic one: light trace on a dark record. */
export type ThemePreference = 'system' | 'paper' | 'film';

const THEMES: readonly ThemePreference[] = ['system', 'paper', 'film'];
const COOKIE = 'fl-theme';

/** The page colour of each theme, `--surface-page`, for the browser's bar around it. */
const BAR: Readonly<Record<Exclude<ThemePreference, 'system'>, string>> = {
  paper: '#f5f1e8',
  film: '#0f0d0a',
};

/**
 * The preference lives in a cookie rather than localStorage because the server
 * has to know it. The page is rendered with the right `data-theme` on `<html>`,
 * so there is no flash of the wrong theme and no blocking inline script to
 * prevent one.
 */
@Service()
export class Theme {
  readonly #document = inject(DOCUMENT);
  readonly #request = inject(REQUEST, { optional: true });
  readonly #isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly #preference = signal<ThemePreference>(this.#readCookie());
  readonly preference = this.#preference.asReadonly();

  constructor() {
    this.#apply(this.#preference());
  }

  set(preference: ThemePreference): void {
    this.#preference.set(preference);
    this.#apply(preference);
    this.#document.cookie = `${COOKIE}=${preference}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }

  #readCookie(): ThemePreference {
    // The server DOM throws on `document.cookie`; there, the request header is the only source.
    const cookies = this.#isBrowser
      ? this.#document.cookie
      : (this.#request?.headers.get('cookie') ?? '');
    const value = cookies
      .split(';')
      .map((part) => part.trim().split('='))
      .find(([name]) => name === COOKIE)?.[1];
    return THEMES.find((theme) => theme === value) ?? 'system';
  }

  #apply(preference: ThemePreference): void {
    const root = this.#document.documentElement;
    if (preference === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', preference);

    // `index.html` colours the bar for the scheme the device asks for; a theme picked here wins.
    for (const meta of this.#document.head.querySelectorAll('meta[name="theme-color"]')) {
      const device = meta.getAttribute('media')?.includes('dark') ? 'film' : 'paper';
      meta.setAttribute('content', BAR[preference === 'system' ? device : preference]);
    }
  }
}
