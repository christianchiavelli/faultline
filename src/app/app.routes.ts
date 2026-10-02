import type { Routes } from '@angular/router';
import { handedOver } from './features/quake/quake-link';

export const routes: Routes = [
  {
    // No title: the home page is the product itself, see `core/page-title.ts`.
    path: '',
    loadComponent: () => import('./features/live/live-page').then((m) => m.LivePage),
  },
  {
    path: 'quakes/:id',
    // The page sets its own title once the event has loaded.
    loadComponent: () => import('./features/quake/quake-page').then((m) => m.QuakePage),
    resolve: { known: handedOver },
  },
  {
    path: '**',
    title: $localize`:tab title of a page that does not exist:Page not found`,
    loadComponent: () => import('./features/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
