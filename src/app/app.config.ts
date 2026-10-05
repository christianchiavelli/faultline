import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideBrowserGlobalErrorListeners, type ApplicationConfig } from '@angular/core';
import { provideClientHydration, withI18nSupport } from '@angular/platform-browser';
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
      // The router only reports where each navigation would scroll; `App` scrolls, since the
      // built-in restoration treats a filter change as a new page.
      withInMemoryScrolling(),
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: crossFadeNewPages,
      }),
      // An event's page opens on what its link knew; waiting for its code first would undo that.
      withPreloading(PreloadAllModules),
    ),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
    provideHttpClient(withInterceptors([transferApiErrors])),
    // Incremental hydration, and the event replay it needs, are on by default since Angular 22.
    // Without i18n support, hydration skips every component that holds a translated message.
    provideClientHydration(withI18nSupport()),
  ],
};
