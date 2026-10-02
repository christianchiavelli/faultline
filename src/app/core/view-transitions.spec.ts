import { TestBed } from '@angular/core/testing';
import {
  Router,
  UrlSegment,
  convertToParamMap,
  type ActivatedRouteSnapshot,
  type ViewTransitionInfo,
} from '@angular/router';
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

function reducedMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced && query === '(prefers-reduced-motion: reduce)',
  }));
}

describe('crossFadeNewPages', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('cross-fades into a new page', () => {
    reducedMotion(false);

    expect(skipped(at(), at('quakes', 'us7000big'))).toBe(false);
  });

  it('swaps a change of filter in place, since it is the same page', () => {
    reducedMotion(false);

    expect(skipped(at(), at())).toBe(true);
  });

  it('swaps every page at once under reduced motion', () => {
    reducedMotion(true);

    expect(skipped(at(), at('quakes', 'us7000big'))).toBe(true);
  });
});

/** An event's page, as the router matches it. */
function eventPage(id: string): ActivatedRouteSnapshot {
  const page = {
    url: [new UrlSegment('quakes', {}), new UrlSegment(id, {})],
    firstChild: null,
    routeConfig: { path: 'quakes/:id' },
    paramMap: convertToParamMap({ id }),
  };
  return { url: [], firstChild: page } as unknown as ActivatedRouteSnapshot;
}

describe('the magnitude flying into an event page', () => {
  let finish!: () => void;
  const transition = () => ({
    skipTransition: vi.fn(),
    finished: new Promise<void>((resolve) => (finish = resolve)),
  });

  let followed: Element | undefined;

  /** Follows `link` into `to`, the link handed over as the navigation's `info`, as a link does. */
  function follow(link: Element | undefined, to: ActivatedRouteSnapshot) {
    followed = link;
    TestBed.runInInjectionContext(() =>
      crossFadeNewPages({
        transition: transition(),
        from: at(),
        to,
      } as unknown as ViewTransitionInfo),
    );
  }

  const named = () =>
    [...document.querySelectorAll<HTMLElement>('[data-magnitude-of]')]
      .filter((element) => element.style.viewTransitionName === 'magnitude')
      .map((element) => element.textContent);

  beforeEach(() => {
    reducedMotion(false);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Router,
          useValue: { currentNavigation: () => ({ extras: { info: followed } }) },
        },
      ],
    });
    // The log's line and the day's largest both read the same event's magnitude.
    document.body.innerHTML = `
      <table><tbody>
        <tr><td><span data-magnitude-of="us1lata">5.1</span></td><td><a href="/quakes/us1lata">Lata</a></td></tr>
        <tr><td><span data-magnitude-of="us1ruteng">4.6</span></td><td><a href="/quakes/us1ruteng">Ruteng</a></td></tr>
      </tbody></table>
      <dd><span data-magnitude-of="us1lata">M5.1</span><a href="/quakes/us1lata">Lata</a></dd>`;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('flies the magnitude read nearest the link followed, and no other', () => {
    follow(document.querySelector('tr a')!, eventPage('us1lata'));

    expect(named()).toEqual(['5.1']);
  });

  it('lets go of it once the page has changed, for the next link to name its own', async () => {
    follow(document.querySelector('dd a')!, eventPage('us1lata'));
    expect(named()).toEqual(['M5.1']);

    finish();
    await Promise.resolve();

    expect(named()).toEqual([]);
  });

  it('flies nothing when no link was followed, or the page is not an event', () => {
    follow(undefined, eventPage('us1lata'));
    follow(document.querySelector('tr a')!, at('about'));

    expect(named()).toEqual([]);
  });
});
