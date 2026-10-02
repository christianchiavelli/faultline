import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RESPONSE_INIT } from '@angular/core';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { RecentQuakesResponse } from '@shared/api/contracts';
import { FakeEventSource } from '@core/testing/fake-event-source';
import { aQuake } from '@shared/testing/quake-fixture';
import { LivePage } from './live-page';

const feed: RecentQuakesResponse = {
  window: 'day',
  generatedAt: Date.now() - 30_000,
  stale: false,
  skipped: 0,
  quakes: [
    aQuake({ id: 'big', magnitude: { value: 5.4, type: 'mww' }, place: 'north of Svalbard' }),
    aQuake({ id: 'mid', magnitude: { value: 3.1, type: 'ml' }, review: 'automatic' }),
    aQuake({
      id: 'blast',
      magnitude: { value: 1.9, type: 'md' },
      kind: 'explosion',
      review: 'automatic',
    }),
  ],
};

/** The page with the feed asked for and not yet answered: a request in flight keeps it from stable. */
function start() {
  const response: ResponseInit = {};
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: RESPONSE_INIT, useValue: response },
    ],
    // The map and the log are deferred until they scroll into view; the readouts are enough here.
    deferBlockBehavior: DeferBlockBehavior.Manual,
  });
  const fixture = TestBed.createComponent(LivePage);
  TestBed.tick();
  return { fixture, response, http: TestBed.inject(HttpTestingController) };
}

async function render(respond: (http: HttpTestingController) => void) {
  const { fixture, response, http } = start();
  respond(http);
  await fixture.whenStable();
  return { element: fixture.nativeElement as HTMLElement, response };
}

const readout = (element: HTMLElement, label: string) =>
  [...element.querySelectorAll('.readout')]
    .find((item) => item.querySelector('dt')?.textContent?.trim() === label)
    ?.querySelector('dd')
    ?.textContent?.replace(/\s+/g, ' ')
    .trim();

const recent = (http: HttpTestingController) =>
  http.expectOne(
    (request) => request.url === '/api/quakes/recent' && request.params.get('window') === 'day',
  );

describe('LivePage', () => {
  // The page follows the feed once it has it; these specs read the copy it was handed.
  beforeEach(() => vi.stubGlobal('EventSource', FakeEventSource));
  afterEach(() => vi.unstubAllGlobals());

  it('reads the day out: counts, largest event, energy share and review share', async () => {
    const { element, response } = await render((http) => recent(http).flush(feed));

    expect(readout(element, 'Events')).toBe('3 2 earthquakes · 1 explosion');
    expect(readout(element, 'Largest')).toContain('M5.4Mww');
    expect(readout(element, 'Largest')).toContain('North of Svalbard');
    // An M5.4 against an M3.1: 10^(1.5 × 2.3) ≈ 2,800 times the energy.
    expect(readout(element, 'Energy')).toMatch(/^100%/);
    expect(readout(element, 'Reviewed')).toMatch(/^33%/);
    expect(element.querySelectorAll('fl-helicorder path.ink')).toHaveLength(24);
    expect(response.status).toBeUndefined();
  });

  it('lays the day out while it waits, and inks the same drum when it comes', async () => {
    const { fixture, http } = start();
    const element = fixture.nativeElement as HTMLElement;
    const drum = element.querySelector('fl-helicorder')!;
    const labels = () => [...element.querySelectorAll('.readouts dt')].map((dt) => dt.textContent);

    expect(drum.querySelector('svg.trace')?.classList).toContain('trace--waiting');
    expect(element.querySelector('.readouts')?.getAttribute('aria-hidden')).toBe('true');
    expect(labels()).toEqual(['Events', 'Largest', 'Energy', 'Reviewed']);
    expect(element.querySelector('.status')?.textContent?.trim()).toBe(
      'Unrolling the last 24 hours…',
    );

    recent(http).flush(feed);
    await fixture.whenStable();

    // Not a new drum swapped in under the reader: the one laid out, inked.
    expect(element.querySelector('fl-helicorder')).toBe(drum);
    expect(drum.querySelector('svg.trace')?.classList).not.toContain('trace--waiting');
    expect(labels()).toEqual(['Events', 'Largest', 'Energy', 'Reviewed']);
    // The sections below wait for the screen to reach them, behind placeholders of their own.
    expect(element.querySelector('.opening ui-skeleton')).toBeNull();
  });

  it('says so when the BFF is serving an old copy', async () => {
    const { element } = await render((http) => recent(http).flush({ ...feed, stale: true }));

    expect(element.querySelector('.callout')?.textContent).toContain(
      'The USGS feed is not answering',
    );
    expect(element.querySelector('.status')?.textContent).toContain('Feed delayed');
  });

  it('offers a retry when there is nothing to show, and answers with the failure status', async () => {
    const { element, response } = await render((http) =>
      recent(http).flush(
        { title: 'The USGS did not answer' },
        { status: 502, statusText: 'Bad Gateway' },
      ),
    );

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'The USGS feed did not answer',
    );
    expect(element.querySelector('[role="alert"] button')?.textContent?.trim()).toBe('Try again');
    // A drum laid out for a day that is not coming would only promise it.
    expect(element.querySelector('fl-helicorder')).toBeNull();
    expect(element.querySelector('ui-skeleton')).toBeNull();
    expect(response.status).toBe(502);
  });
});
