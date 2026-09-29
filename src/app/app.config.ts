import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideBrowserGlobalErrorListeners, type ApplicationConfig } from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
  withIncrementalHydration,
} from '@angular/platform-browser';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
  type ActivatedRouteSnapshot,
} from '@angular/router';
import { routes } from './app.routes';
import { transferApiErrors } from './core/api/transfer-errors';
import { PageTitleStrategy } from './core/page-title';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Scrolling is handled in `App`: the built-in restoration treats a filter change as a new page.
      withInMemoryScrolling({ scrollPositionRestoration: 'disabled', anchorScrolling: 'enabled' }),
      withViewTransitions({
        skipInitialTransition: true,
        // A cross-fade marks a new page. Changing a filter is the same page, so it swaps in place.
        onViewTransitionCreated: ({ transition, from, to }) => {
          if (pathOf(from) === pathOf(to)) transition.skipTransition();
        },
      }),
    ),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    provideHttpClient(withFetch(), withInterceptors([transferApiErrors])),
    provideClientHydration(withEventReplay(), withIncrementalHydration()),
  ],
};

function pathOf(snapshot: ActivatedRouteSnapshot): string {
  return snapshot.pathFromRoot.map((route) => route.url.join('/')).join('/');
}
