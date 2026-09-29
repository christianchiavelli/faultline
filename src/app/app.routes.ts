import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Faultline · a live seismograph of the planet',
    loadComponent: () => import('./features/live/live-page').then((m) => m.LivePage),
  },
  {
    path: 'quakes/:id',
    // The page sets its own title once the event has loaded.
    loadComponent: () => import('./features/quake/quake-page').then((m) => m.QuakePage),
  },
  {
    path: '**',
    title: 'Nothing recorded here · Faultline',
    loadComponent: () => import('./features/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
