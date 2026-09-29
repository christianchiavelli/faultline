import { httpResource } from '@angular/common/http';
import type { FeedWindow, QuakeDetailResponse, RecentQuakesResponse } from '@shared/api/contracts';

/**
 * Data access for the app. Both need an injection context, like any
 * `httpResource`: call them from a field initializer.
 *
 * During SSR these requests never touch the network; see `in-process-backend.ts`.
 */

export function recentQuakesResource(window: () => FeedWindow) {
  return httpResource<RecentQuakesResponse>(() => ({
    url: '/api/quakes/recent',
    params: { window: window() },
  }));
}

export function quakeDetailResource(id: () => string) {
  return httpResource<QuakeDetailResponse>(() => `/api/quakes/${encodeURIComponent(id())}`);
}
