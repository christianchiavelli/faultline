import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import type { QuakeDetailResponse } from '@shared/api/contracts';
import type { QuakeSummary } from '@shared/domain/quake';
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

/** What the log knew of the event: the summary its link hands over. */
const { id, time, magnitude, place, location, review, kind } = detail.quake;
const summary: QuakeSummary = { id, time, magnitude, place, location, review, kind };

/** The page with the event asked for and not yet answered: a request in flight keeps it from stable. */
function start(known?: QuakeSummary) {
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
  if (known) fixture.componentRef.setInput('known', known);
  TestBed.tick();
  return { fixture, response, http: TestBed.inject(HttpTestingController) };
}

async function render(respond: (http: HttpTestingController) => void) {
  const { fixture, response, http } = start();
  respond(http);
  await fixture.whenStable();
  return { element: fixture.nativeElement as HTMLElement, response };
}

const described = (items: NodeListOf<Element>, label: string) =>
  [...items]
    .find((item) => item.querySelector('dt')?.textContent?.trim() === label)
    ?.querySelector('dd')
    ?.textContent?.replace(/\s+/g, ' ')
    .trim();

const readout = (element: HTMLElement, label: string) =>
  described(element.querySelectorAll('.readout'), label);

const fact = (element: HTMLElement, label: string) =>
  described(element.querySelectorAll('.facts > div'), label);

describe('QuakePage', () => {
  it('shows the shape of the event while the catalogue looks it up, and says so in words', async () => {
    const { fixture, http } = start();
    const element = fixture.nativeElement as HTMLElement;
    const shape = element.querySelector('.readouts')!;

    expect(element.querySelector('.hero')?.getAttribute('aria-hidden')).toBe('true');
    expect(shape.getAttribute('aria-hidden')).toBe('true');
    expect([...shape.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual([
      'Depth',
      'Epicentre',
      'Solution',
      'Energy',
    ]);
    expect(element.querySelector('h1')?.textContent?.trim()).toBe(
      'Looking the event up in the USGS catalogue…',
    );

    http.expectOne('/api/quakes/us6000ty57').flush(detail);
    await fixture.whenStable();

    expect(element.querySelector('ui-skeleton')).toBeNull();
    expect(element.querySelector('h1')?.textContent).toBe('North of Svalbard');
  });

  it('leads with the magnitude and the scale it was measured on', async () => {
    const { element } = await render((http) =>
      http.expectOne('/api/quakes/us6000ty57').flush(detail),
    );

    expect(element.querySelector('.numeral')?.textContent).toContain('5.4');
    expect(element.querySelector('.scale')?.textContent).toContain('Moment W-phase magnitude');
    expect(element.querySelector('h1')?.textContent).toBe('North of Svalbard');
    expect(TestBed.inject(Title).getTitle()).toBe('M5.4 North of Svalbard | Faultline');
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

  it('says in words how long after the event it was last revised', async () => {
    const { element } = await render((http) =>
      http.expectOne('/api/quakes/us6000ty57').flush(detail),
    );

    // 04:16:27 to 05:00:00, rounded down.
    expect(fact(element, 'Last revised')).toBe('29 Sept, 05:00 UTC, 43 minutes after the event');
  });

  it('opens on what its link knew, and waits only for what the record adds', async () => {
    const { fixture, http } = start(summary);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toBe('North of Svalbard');
    expect(element.querySelector('.numeral')?.textContent).toContain('5.4');
    expect(element.querySelector('.readouts')?.getAttribute('aria-hidden')).toBeNull();
    expect(readout(element, 'Depth')).toBe('10.0km');
    expect(readout(element, 'Energy')).toContain('7.9×1012J');
    expect(readout(element, 'Solution')).toBe('Coming from the USGS catalogue…');
    expect(element.querySelector('.facts')?.getAttribute('aria-hidden')).toBe('true');
    expect(TestBed.inject(Title).getTitle()).toBe('M5.4 North of Svalbard | Faultline');

    http.expectOne('/api/quakes/us6000ty57').flush(detail);
    await fixture.whenStable();

    expect(element.querySelector('ui-skeleton')).toBeNull();
    expect(readout(element, 'Solution')).toContain('81stations');
    expect(readout(element, 'Depth')).toContain('Fixed by the analyst, not measured');
    expect(fact(element, 'Located by')).toContain('us');
  });

  it('lets go of what its link knew once the catalogue says the event is gone', async () => {
    const { fixture, http } = start(summary);
    http
      .expectOne('/api/quakes/us6000ty57')
      .flush(
        { type: 'about:blank', title: 'This event was deleted', status: 410 },
        { status: 410, statusText: 'Gone' },
      );
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toBe('This event was deleted');
    expect(element.querySelector('.numeral')).toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('Event deleted | Faultline');
  });

  it('keeps what its link knew when the rest does not come, and asks again on request', async () => {
    const { fixture, http } = start(summary);
    const element = fixture.nativeElement as HTMLElement;
    http
      .expectOne('/api/quakes/us6000ty57')
      .flush(
        { type: 'about:blank', title: 'The USGS did not answer', status: 502 },
        { status: 502, statusText: 'Bad Gateway' },
      );
    await fixture.whenStable();

    expect(element.querySelector('h1')?.textContent).toBe('North of Svalbard');
    expect(readout(element, 'Solution')).toBe('—');
    const failure = element.querySelector('.record [role="alert"]');
    expect(failure?.textContent).toContain('The USGS did not answer');

    failure?.querySelector('button')?.click();
    TestBed.tick();
    http.expectOne('/api/quakes/us6000ty57').flush(detail);
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(readout(element, 'Solution')).toContain('81stations');
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
    expect(TestBed.inject(Title).getTitle()).toBe('Event not found | Faultline');
    expect(response.status).toBe(404);
  });
});
