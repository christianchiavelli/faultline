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

/** A history entry outlives a deploy, so what it holds is checked, not trusted. */
function isSummaryOf(value: unknown, id: string | null): value is QuakeSummary {
  if (typeof value !== 'object' || value === null) return false;
  const quake = value as Partial<Record<keyof QuakeSummary, unknown>>;
  return (
    quake.id === id &&
    typeof quake.time === 'number' &&
    typeof quake.kind === 'string' &&
    typeof quake.location === 'object' &&
    quake.location !== null
  );
}
