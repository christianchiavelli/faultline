import { UrlSegment, type ActivatedRouteSnapshot, type ViewTransitionInfo } from '@angular/router';
import { crossFadeNewPages } from './view-transitions';

/** A route tree as the router hands it over: its root, with the page's route under it. */
function at(...path: string[]): ActivatedRouteSnapshot {
  const page = { url: path.map((part) => new UrlSegment(part, {})), firstChild: null };
  return { url: [], firstChild: page } as unknown as ActivatedRouteSnapshot;
}

/** Whether going `from` one page `to` another skipped its cross-fade. */
function skipped(from: ActivatedRouteSnapshot, to: ActivatedRouteSnapshot): boolean {
  const skipTransition = vi.fn();
  crossFadeNewPages({ transition: { skipTransition }, from, to } as unknown as ViewTransitionInfo);
  return skipTransition.mock.calls.length > 0;
}

describe('crossFadeNewPages', () => {
  it('cross-fades into a new page', () => {
    expect(skipped(at(), at('quakes', 'us7000big'))).toBe(false);
  });

  it('swaps a change of filter in place, since it is the same page', () => {
    expect(skipped(at(), at())).toBe(true);
  });
});
