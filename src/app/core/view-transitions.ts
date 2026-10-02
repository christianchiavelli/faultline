import { inject } from '@angular/core';
import { Router, type ActivatedRouteSnapshot, type ViewTransitionInfo } from '@angular/router';

/**
 * A new page cross-fades in, the bar holding still (`motion.css`). Changing a
 * filter is the same page, so it swaps in place; and under reduced motion
 * every page swaps at once, without taking the snapshots a cross-fade needs.
 */
export function crossFadeNewPages({ transition, from, to }: ViewTransitionInfo): void {
  if (pathOf(from) === pathOf(to) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    transition.skipTransition();
    return;
  }
  flyMagnitude(transition, to);
}

/**
 * Into an event's page, the magnitude read nearest the link followed flies
 * into the page's title, which is named for it in its own styles. A link hands
 * itself over as the navigation's `info`. Named here, the old page has not
 * been captured yet: the browser takes it at the next frame.
 */
function flyMagnitude(transition: ViewTransition, to: ActivatedRouteSnapshot): void {
  const id = eventOf(to);
  if (!id) return;
  const link = inject(Router).currentNavigation()?.extras.info;
  if (!(link instanceof Element)) return;

  const selector = `[data-magnitude-of="${CSS.escape(id)}"]`;
  const magnitude = link.matches(selector)
    ? link
    : link.closest(`:has(${selector})`)?.querySelector(selector);
  if (!(magnitude instanceof HTMLElement)) return;

  magnitude.style.viewTransitionName = 'magnitude';
  const land = () => magnitude.style.removeProperty('view-transition-name');
  transition.finished.then(land, land);
}

/** The event a route tree shows, if it is an event's page. */
function eventOf(root: ActivatedRouteSnapshot): string | null {
  let route: ActivatedRouteSnapshot = root;
  while (route.firstChild) route = route.firstChild;
  return route.routeConfig?.path === 'quakes/:id' ? route.paramMap.get('id') : null;
}

/**
 * The path a route tree shows. The router hands over the roots of its trees,
 * which match no segment themselves: the path is in the routes under them.
 */
function pathOf(root: ActivatedRouteSnapshot): string {
  const segments: string[] = [];
  for (let route: ActivatedRouteSnapshot | null = root; route; route = route.firstChild) {
    segments.push(...route.url.map((segment) => segment.path));
  }
  return segments.join('/');
}
