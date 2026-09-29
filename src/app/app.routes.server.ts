import { RenderMode, type ServerRoute } from '@angular/ssr';

/**
 * Everything renders per request: the data changes every minute, so a
 * prerendered page would be wrong by the time it was served.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
  { path: 'quakes/:id', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Server, status: 404 },
];
