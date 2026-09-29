import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import type { QuakeDetailResponse } from '@shared/api/contracts';
import { aQuake } from '@shared/testing/quake-fixture';
import { QuakePage } from './quake-page';

const detail: QuakeDetailResponse = {
  quake: aQuake({
    id: 'us6000ty57',
    magnitude: { value: 5.4, type: 'mww' },
    place: 'north of Svalbard',
    location: { latitude: 82.639, longitude: -7.192, depthKm: 10 },
  }),
  origin: {
    horizontalErrorKm: 9.29,
    depthErrorKm: 1.733,
    stationsUsed: 81,
    azimuthalGapDeg: 60,
    depthType: 'operator assigned',
  },
};

async function render(respond: (http: HttpTestingController) => void) {
  const response: ResponseInit = {};
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: RESPONSE_INIT, useValue: response },
    ],
  });
  const fixture = TestBed.createComponent(QuakePage);
  fixture.componentRef.setInput('id', 'us6000ty57');
  TestBed.tick();
  respond(TestBed.inject(HttpTestingController));
  await fixture.whenStable();
  return { element: fixture.nativeElement as HTMLElement, response };
}

const readout = (element: HTMLElement, label: string) =>
  [...element.querySelectorAll('.readout')]
    .find((item) => item.querySelector('dt')?.textContent?.trim() === label)
    ?.querySelector('dd')
    ?.textContent?.replace(/\s+/g, ' ')
    .trim();

describe('QuakePage', () => {
  it('leads with the magnitude and the scale it was measured on', async () => {
    const { element } = await render((http) =>
      http.expectOne('/api/quakes/us6000ty57').flush(detail),
    );

    expect(element.querySelector('.numeral')?.textContent).toContain('5.4');
    expect(element.querySelector('.scale')?.textContent).toContain('Moment W-phase magnitude');
    expect(element.querySelector('h1')?.textContent).toBe('North of Svalbard');
    expect(TestBed.inject(Title).getTitle()).toBe('M5.4 North of Svalbard · Faultline');
  });

  it('says when the depth was fixed by the analyst rather than measured', async () => {
    const { element } = await render((http) =>
      http.expectOne('/api/quakes/us6000ty57').flush(detail),
    );

    expect(readout(element, 'Depth')).toContain('Fixed by the analyst, not measured');
    expect(readout(element, 'Epicentre')).toContain('± 9.3 km horizontal uncertainty');
  });

  it('puts the energy in joules and in tonnes of TNT', async () => {
    const { element } = await render((http) =>
      http.expectOne('/api/quakes/us6000ty57').flush(detail),
    );

    expect(readout(element, 'Energy')).toContain('7.9×1012J');
    expect(readout(element, 'Energy')).toContain('about 1,900 tonnes of TNT');
  });

  it('renders a missing event with the real status, for crawlers and monitors', async () => {
    const { element, response } = await render((http) =>
      http
        .expectOne('/api/quakes/us6000ty57')
        .flush(
          { type: 'about:blank', title: 'No such event', status: 404 },
          { status: 404, statusText: 'Not Found' },
        ),
    );

    expect(element.querySelector('h1')?.textContent).toBe('No such event');
    expect(response.status).toBe(404);
  });
});
