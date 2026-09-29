import { ViewportScroller } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet, Scroll } from '@angular/router';
import { filter } from 'rxjs';
import { SiteFooter } from './shell/site-footer';
import { TopBar } from './shell/top-bar';

@Component({
  selector: 'fl-root',
  imports: [RouterOutlet, TopBar, SiteFooter],
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <fl-top-bar />
    <main id="main" tabindex="-1">
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
  constructor() {
    restoreScrollByPath();
  }
}

/**
 * The router's own restoration scrolls to the top on every navigation, which
 * includes changing a filter in the query string: the reader clicks "M4.5+"
 * halfway down the log and is thrown back to the header. Here, the top only
 * comes back when the path changes, and back/forward restores where they were.
 */
function restoreScrollByPath(): void {
  const scroller = inject(ViewportScroller);
  // Otherwise the browser restores its own idea of the position on back/forward, before the page has rendered.
  scroller.setHistoryScrollRestoration('manual');

  // Tracked on NavigationEnd, not Scroll: the router emits no Scroll event for
  // the navigation that runs during hydration, and the first path must be known.
  let currentPath: string | null = null;
  let pathChanged = false;

  const subscription = inject(Router)
    .events.pipe(filter((event) => event instanceof NavigationEnd || event instanceof Scroll))
    .subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const path = pathOf(event.urlAfterRedirects);
        pathChanged = currentPath !== null && path !== currentPath;
        currentPath = path;
      } else if (event.position) {
        scroller.scrollToPosition(event.position);
      } else if (event.anchor) {
        scroller.scrollToAnchor(event.anchor);
      } else if (pathChanged) {
        scroller.scrollToPosition([0, 0]);
      }
    });

  inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
}

function pathOf(url: string): string {
  return url.split(/[?#]/)[0] ?? url;
}
