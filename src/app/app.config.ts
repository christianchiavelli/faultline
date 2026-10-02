import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideBrowserGlobalErrorListeners, type ApplicationConfig } from '@angular/core';
import {
  provideClientHydration,
  withEventReplay,
  withI18nSupport,
  withIncrementalHydration,
} from '@angular/platform-browser';
import {
  PreloadAllModules,
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withPreloading,
  withViewTransitions,
} from '@angular/router';
import { routes } from './app.routes';
import { transferApiErrors } from './core/api/transfer-errors';
import { PageTitleStrategy } from './core/page-title';
import { crossFadeNewPages } from './core/view-transitions';

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
        onViewTransitionCreated: crossFadeNewPages,
      }),
      // An event's page opens on what its link knew; waiting for its code first would undo that.
      withPreloading(PreloadAllModules),
    ),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    provideHttpClient(withFetch(), withInterceptors([transferApiErrors])),
    // Without i18n support, hydration skips every component that holds a translated message.
    provideClientHydration(withEventReplay(), withIncrementalHydration(), withI18nSupport()),
  ],
};
