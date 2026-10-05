import { Location, ViewportScroller } from '@angular/common';
import {
  Component,
  computed,
  inject,
  viewChild,
  type ElementRef,
  type Signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterOutlet, Scroll } from '@angular/router';
import { filter } from 'rxjs';
import { currentPage } from './core/current-page';
import { linkAlternateLanguages } from './core/languages';
import { SITE_DESCRIPTION } from './core/page-description';
import { SiteFooter } from './shell/site-footer';
import { TopBar } from './shell/top-bar';

@Component({
  selector: 'fl-root',
  imports: [RouterOutlet, TopBar, SiteFooter],
  template: `
    <a class="skip-link" [href]="skipLink()" i18n="link to jump past the top bar"
      >Skip to content</a
    >
    <fl-top-bar />
    <main #main id="main" tabindex="-1">
      <router-outlet />
    </main>
    <fl-site-footer />
  `,
  styles: `
    :host {
      display: grid;
      grid-template-rows: auto 1fr auto;
      min-height: 100dvh;
    }

    main:focus {
      outline: none;
    }

    .skip-link {
      position: absolute;
      inset-block-start: var(--space-2);
      inset-inline-start: var(--space-2);
      z-index: 10;
      padding: var(--space-2) var(--space-3);
      background: var(--surface-inverse);
      color: var(--content-inverse);
      translate: 0 -200%;

      &:focus-visible {
        translate: 0 0;
      }
    }
  `,
})
export class App {
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');
  protected readonly skipLink = linkToContent();

  constructor() {
    scrollByPath(() => this.main().nativeElement.focus({ preventScroll: true }));
    linkAlternateLanguages();
    // Every page's, but those with something of their own to say (`describePage`).
    inject(Meta).updateTag({ name: 'description', content: SITE_DESCRIPTION });
  }
}

/**
 * The page the reader is on, at its content. A bare `#main` would be read
 * against `<base href>`, and lead from every page but the home page to the
 * home page. A plain link rather than a click handler, so it works before the
 * app has hydrated: the browser scrolls to the content and focuses it.
 */
function linkToContent(): Signal<string> {
  const page = currentPage();
  const location = inject(Location);
  return computed(() => `${location.prepareExternalUrl(page())}#main`);
}

/**
 * The router's own restoration scrolls to the top on every navigation, which
 * includes changing a filter in the query string: the reader clicks "M4.5+"
 * halfway down the log and is thrown back to the header. Here, the top only
 * comes back when the path changes, and back/forward restores where they were.
 *
 * A new path is a new page, and `onNewPage` moves focus to it: otherwise it
 * stays on a link the old page took with it, and a screen reader hears nothing
 * of the new one.
 */
function scrollByPath(onNewPage: () => void): void {
  const scroller = inject(ViewportScroller);
  // Otherwise the browser restores its own idea of the position on back/forward, before the page has rendered.
  scroller.setHistoryScrollRestoration('manual');

  // Tracked on NavigationEnd, not Scroll: the router emits no Scroll event for
  // the navigation that runs during hydration, and the first URL must be known.
  let current: string | null = null;
  // What the last navigation changed, until its Scroll event. A click on a
  // link to the page already shown has a Scroll event and no NavigationEnd.
  let change: 'path' | 'filters' | 'fragment' | null = null;

  inject(Router)
    .events.pipe(
      filter((event) => event instanceof NavigationEnd || event instanceof Scroll),
      takeUntilDestroyed(),
    )
    .subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const url = event.urlAfterRedirects;
        change = !current
          ? null
          : pathOf(url) !== pathOf(current)
            ? 'path'
            : pageOf(url) !== pageOf(current)
              ? 'filters'
              : 'fragment';
        current = url;
        return;
      }
      const changed = change;
      change = null;
      // A link within the page, such as the skip link: the browser has scrolled to it already.
      if (changed === 'fragment') return;
      if (event.position) scroller.scrollToPosition(event.position);
      else if (changed === 'path') scroller.scrollToPosition([0, 0]);
      if (changed === 'path') onNewPage();
    });
}

/** The URL without its fragment: the path and the filters. */
function pageOf(url: string): string {
  return url.split('#')[0] ?? url;
}

function pathOf(url: string): string {
  return url.split(/[?#]/)[0] ?? url;
}
