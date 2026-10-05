import { inject } from '@angular/core';
import { Router, type ResolveFn } from '@angular/router';
import type { QuakeSummary } from '@shared/domain/quake';

/**
 * What a link to an event hands the page in its navigation state: the event
 * as the list it was in already knows it. The page opens on that at once, and
 * asks the catalogue only for the rest. It is kept in the history entry, so
 * Back and Forward open on it too.
 */
export interface QuakeLinkState {
  readonly quake: QuakeSummary;
}

export function quakeLinkState(quake: QuakeSummary): QuakeLinkState {
  return { quake };
}

/**
 * The summary the link to this event handed over, if one did: a page loaded
 * from its address, or rendered on the server, starts from nothing.
 */
export const handedOver: ResolveFn<QuakeSummary | null> = (route) => {
  const state = inject(Router).currentNavigation()?.extras.state;
  const quake: unknown = state?.['quake'];
  return isSummaryOf(quake, route.paramMap.get('id')) ? quake : null;
};

/**
 * A history entry outlives a deploy, so what it holds is checked, not
 * trusted: every field the page reads, in the shape it reads it.
 */
function isSummaryOf(value: unknown, id: string | null): value is QuakeSummary {
  if (!isRecord(value) || value['id'] !== id) return false;
  const { time, magnitude, place, location, review, kind } = value;
  return (
    typeof time === 'number' &&
    (magnitude === null ||
      (isRecord(magnitude) &&
        typeof magnitude['value'] === 'number' &&
        typeof magnitude['type'] === 'string')) &&
    (place === null || typeof place === 'string') &&
    isRecord(location) &&
    typeof location['latitude'] === 'number' &&
    typeof location['longitude'] === 'number' &&
    (location['depthKm'] === null || typeof location['depthKm'] === 'number') &&
    (review === 'automatic' || review === 'reviewed') &&
    typeof kind === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
