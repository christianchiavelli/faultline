import type { ActivatedRouteSnapshot, ViewTransitionInfo } from '@angular/router';

/**
 * A new page cross-fades in, the bar holding still (`motion.css`). Changing a
 * filter is the same page, so it swaps in place; and under reduced motion
 * every page swaps at once, without taking the snapshots a cross-fade needs.
 */
export function crossFadeNewPages({ transition, from, to }: ViewTransitionInfo): void {
  if (pathOf(from) === pathOf(to) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    transition.skipTransition();
  }
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
