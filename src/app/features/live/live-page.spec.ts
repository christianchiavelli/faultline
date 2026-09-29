import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { RecentQuakesResponse } from '@shared/api/contracts';
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

async function render(respond: (http: HttpTestingController) => void) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    // The map and the log are deferred until they scroll into view; the readouts are enough here.
    deferBlockBehavior: DeferBlockBehavior.Manual,
  });
  const fixture = TestBed.createComponent(LivePage);
  TestBed.tick();
  respond(TestBed.inject(HttpTestingController));
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
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
  it('reads the day out: counts, largest event, energy share and review share', async () => {
    const element = await render((http) => recent(http).flush(feed));

    expect(readout(element, 'Events')).toBe('3 2 earthquakes · 1 explosion');
    expect(readout(element, 'Largest')).toContain('M5.4Mww');
    expect(readout(element, 'Largest')).toContain('North of Svalbard');
    // An M5.4 against an M3.1: 10^(1.5 × 2.3) ≈ 2,800 times the energy.
    expect(readout(element, 'Energy')).toMatch(/^100%/);
    expect(readout(element, 'Reviewed')).toMatch(/^33%/);
    expect(element.querySelectorAll('fl-helicorder path.ink')).toHaveLength(24);
  });

  it('says so when the BFF is serving an old copy', async () => {
    const element = await render((http) => recent(http).flush({ ...feed, stale: true }));

    expect(element.querySelector('.callout')?.textContent).toContain(
      'The USGS feed is not answering',
    );
    expect(element.querySelector('.status')?.textContent).toContain('Feed delayed');
  });

  it('offers a retry when there is nothing to show', async () => {
    const element = await render((http) =>
      recent(http).flush(
        { title: 'The USGS did not answer' },
        { status: 502, statusText: 'Bad Gateway' },
      ),
    );

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'The USGS feed did not answer',
    );
    expect(element.querySelector('[role="alert"] button')?.textContent?.trim()).toBe('Try again');
  });
});
