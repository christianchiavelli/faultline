import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QUERY_CLIENT } from '@core/api/query-client';
import { Clock } from '@core/clock';
import type { ExportCount } from '@shared/api/export';
import type { QuakeSummary } from '@shared/domain/quake';
import { aQuake } from '@shared/testing/quake-fixture';
import { defaultScheduler, notifyManager } from '@tanstack/angular-query-experimental';
import { polyfillDialog } from '@ui/testing/dialog-polyfill';
import { ExportDialog } from './export-dialog';

/** 19:30:12 UTC, so the relative periods end at 19:31, the next whole minute. */
const NOW = Date.UTC(2026, 8, 29, 19, 30, 12);

const ende = aQuake({
  magnitude: { value: 7.8, type: 'mww' },
  place: '66 km NNW of Ende, Indonesia',
  location: { latitude: -8.2, longitude: 121.5, depthKm: 10 },
});

/*
 * A count in flight is a pending task, so `whenStable` would wait for an
 * answer the spec has yet to give. Actions render with `TestBed.tick()`
 * instead, and an answer gets one task to travel through its promises.
 */

function render(options: { event?: QuakeSummary; open?: boolean } = {}) {
  polyfillDialog();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: Clock, useValue: { now: signal(NOW).asReadonly() } },
    ],
  });
  // A failure is asserted as it happens, not after a retry a second later.
  TestBed.inject(QUERY_CLIENT).setQueryDefaults(['export-count'], { retry: false });

  const fixture = TestBed.createComponent(ExportDialog);
  if (options.event) fixture.componentRef.setInput('event', options.event);
  fixture.componentRef.setInput('open', options.open ?? true);
  TestBed.tick();
  return {
    fixture,
    dialog: fixture.componentInstance,
    element: fixture.nativeElement as HTMLElement,
    http: TestBed.inject(HttpTestingController),
  };
}

const isCount = (request: { url: string }) => request.url.startsWith('/api/quakes/count?');

/** Every count asked for since the last look. */
const counts = (http: HttpTestingController) => http.match(isCount);

const onlyCount = (http: HttpTestingController) => http.expectOne(isCount);

function paramsOf(request: TestRequest | string): Record<string, string> {
  const url = typeof request === 'string' ? request : request.request.url;
  return Object.fromEntries(new URL(url, 'http://localhost').searchParams);
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve));
  TestBed.tick();
}

function answer(request: TestRequest, count: number) {
  request.flush({ count, limit: 100_000 } satisfies ExportCount);
  return settle();
}

function choose(element: HTMLElement, label: string) {
  const choice = [...element.querySelectorAll('label')].find(
    (candidate) => candidate.textContent?.trim().startsWith(label) ?? false,
  );
  if (!choice) throw new Error(`No choice labelled ${label}`);
  choice.querySelector('input')!.click();
  TestBed.tick();
}

function press(element: HTMLElement, name: string) {
  const button = [...element.querySelectorAll('button')].find(
    (candidate) => text(candidate) === name,
  );
  if (!button) throw new Error(`No button named ${name}`);
  button.click();
  TestBed.tick();
}

function enterDate(input: HTMLInputElement, day: string) {
  input.value = day;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
  TestBed.tick();
}

const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();

const download = (element: HTMLElement) => element.querySelector<HTMLAnchorElement>('a[download]');

describe('ExportDialog', () => {
  // TanStack Query tells its observers on the next task; in a spec, at once.
  beforeEach(() => notifyManager.setScheduler((callback) => callback()));
  afterEach(() => notifyManager.setScheduler(defaultScheduler));

  it('counts nothing until it is open', () => {
    const { http } = render({ open: false });

    expect(counts(http)).toEqual([]);
  });

  it('opens on the last day of the whole world, and counts it', async () => {
    const { element, http } = render();

    const request = onlyCount(http);
    expect(paramsOf(request)).toEqual({
      from: '2026-09-28T19:31:00Z',
      to: '2026-09-29T19:31:00Z',
      minmag: '2.5',
    });
    expect(text(element.querySelector('.result'))).toContain('Counting the events…');

    await answer(request, 1994);

    expect(text(element.querySelector('.count'))).toBe(
      '1,994events About 518 kB, worldwide, M2.5 and up',
    );
    expect(text(download(element))).toBe('Download 1,994 events');
    expect(paramsOf(download(element)!.href)).toEqual({
      from: '2026-09-28T19:31:00Z',
      to: '2026-09-29T19:31:00Z',
      minmag: '2.5',
      format: 'csv',
    });
  });

  it('changes the file without counting again', async () => {
    const { element, http } = render();
    await answer(onlyCount(http), 1994);

    choose(element, 'Map data');

    expect(counts(http)).toEqual([]);
    expect(paramsOf(download(element)!.href)['format']).toBe('geojson');
    expect(text(element.querySelector('.count .hint'))).toBe(
      'About 1.1 MB, worldwide, M2.5 and up',
    );
  });

  it('keeps the last count up while the next one loads, and offers no file until it lands', async () => {
    const { element, http } = render();
    await answer(onlyCount(http), 1994);

    choose(element, '4.5+');

    const next = onlyCount(http);
    expect(paramsOf(next)['minmag']).toBe('4.5');
    expect(element.querySelector('.count')?.classList).toContain('count--settling');
    expect(text(element.querySelector('.count .value'))).toBe('1,994events');
    expect(text(element.querySelector('.count .hint'))).toBe('Counting…');
    expect(download(element)).toBeNull();

    await answer(next, 41);

    expect(element.querySelector('.count')?.classList).not.toContain('count--settling');
    expect(text(download(element))).toBe('Download 41 events');
  });

  it('answers a choice already counted from memory', async () => {
    const { element, http } = render();
    await answer(onlyCount(http), 1994);
    choose(element, '4.5+');
    await answer(onlyCount(http), 41);

    choose(element, '2.5+');

    expect(counts(http)).toEqual([]);
    expect(text(download(element))).toBe('Download 1,994 events');
  });

  it('says so when nothing matches, and offers no empty file', async () => {
    const { element, http } = render();

    await answer(onlyCount(http), 0);

    expect(text(element.querySelector('.count .hint'))).toBe(
      'Nothing matches. Try a longer period or a smaller magnitude.',
    );
    expect(download(element)).toBeNull();
  });

  it('offers to try again when the count fails', async () => {
    const { element, http } = render();

    onlyCount(http).flush(
      { type: 'about:blank', title: 'The USGS did not answer', status: 502 },
      { status: 502, statusText: 'Bad Gateway' },
    );
    await settle();

    expect(text(element.querySelector('.result'))).toContain('The USGS did not answer the count.');
    expect(download(element)).toBeNull();

    press(element, 'Try again');
    await answer(onlyCount(http), 1994);

    expect(text(download(element))).toBe('Download 1,994 events');
  });

  describe('over the limit', () => {
    async function overTheLimit() {
      const rendered = render();
      await answer(onlyCount(rendered.http), 1994);
      choose(rendered.element, '30 days');
      await answer(onlyCount(rendered.http), 250_000);
      return rendered;
    }

    it('explains the limit and points to the USGS search, with no file to download', async () => {
      const { element } = await overTheLimit();

      expect(text(element.querySelector('.over .value'))).toBe('250,000events');
      expect(text(element.querySelector('.over .hint'))).toContain(
        'An export stops at 100,000 events',
      );
      expect(element.querySelector('.over a[href]')?.getAttribute('href')).toBe(
        'https://earthquake.usgs.gov/earthquakes/search/',
      );
      expect(download(element)).toBeNull();
    });

    it('counts a higher floor and a shorter period, and offers only those that fit', async () => {
      const { element, http } = await overTheLimit();

      const candidates = counts(http);
      expect(candidates.map(paramsOf)).toEqual([
        expect.objectContaining({ from: '2026-08-30T19:31:00Z', minmag: '4.5' }),
        expect.objectContaining({ from: '2026-09-22T19:31:00Z', minmag: '2.5' }),
      ]);

      await answer(candidates[0]!, 3800);
      await answer(candidates[1]!, 120_000);

      expect([...element.querySelectorAll('.suggestion')].map(text)).toEqual([
        'Only M4.5 and up 3,800 events',
      ]);
    });

    it('applies a suggestion without counting it again', async () => {
      const { element, http } = await overTheLimit();
      for (const candidate of counts(http)) await answer(candidate, 3800);

      element.querySelector<HTMLButtonElement>('.suggestion')!.click();
      TestBed.tick();

      expect(counts(http)).toEqual([]);
      expect(text(download(element))).toBe('Download 3,800 events');
    });
  });

  describe('a custom period', () => {
    async function custom() {
      const rendered = render();
      await answer(onlyCount(rendered.http), 1994);
      choose(rendered.element, 'Custom');
      const [from, to] = rendered.element.querySelectorAll<HTMLInputElement>('input[type=date]');
      return { ...rendered, from: from!, to: to! };
    }

    it('starts on the last 30 days, in whole days, the last one included', async () => {
      const { from, to, http } = await custom();

      expect([from.value, to.value]).toEqual(['2026-08-30', '2026-09-29']);
      expect(paramsOf(onlyCount(http))).toMatchObject({
        from: '2026-08-30T00:00:00Z',
        to: '2026-09-30T00:00:00Z',
      });
    });

    it.each([
      ['an end before the start', '2026-09-01', '2026-08-01', 'End on or after the start.'],
      ['a start before the record', '1899-12-31', '2026-09-29', 'The catalogue starts in 1900.'],
      ['an end after today', '2026-09-01', '2026-09-30', 'Pick a day up to today.'],
    ])('refuses %s, next to the field, and counts nothing', async (_, start, end, message) => {
      const { element, http, from, to } = await custom();
      enterDate(from, start);
      counts(http);

      enterDate(to, end);

      const error = element.querySelector('.error');
      expect(text(error)).toBe(message);
      expect([from, to].map((input) => input.getAttribute('aria-describedby'))).toContain(
        error?.id,
      );
      expect(text(element.querySelector('.result'))).toContain(
        'Fix the dates above to count the events.',
      );
      expect(counts(http)).toEqual([]);
    });
  });

  describe('from an event', () => {
    it('opens on the events around it since it happened, at every magnitude', () => {
      const { element, http } = render({ event: ende });

      expect(text(element.querySelector('.lede'))).toBe(
        'Around the M7.8 66 km NNW of Ende, Indonesia, on 29 Sept 2026 at 04:16 UTC.',
      );
      expect(paramsOf(onlyCount(http))).toEqual({
        from: '2026-09-29T04:16:27Z',
        to: '2026-09-29T19:31:00Z',
        lat: '-8.2',
        lon: '121.5',
        radiuskm: '100',
      });
    });

    it('counts one event as one event', async () => {
      const { element, http } = render({ event: ende });

      await answer(onlyCount(http), 1);

      expect(text(element.querySelector('.count .value'))).toBe('1event');
      expect(text(download(element))).toBe('Download 1 event');
    });

    it('keeps what the reader chose through a new copy of its event, and starts over for another', async () => {
      const { fixture, element, http } = render({ event: ende });
      await answer(onlyCount(http), 312);
      choose(element, '250');
      await answer(onlyCount(http), 400);

      // The record comes in: the same event, in a new object.
      fixture.componentRef.setInput('event', { ...ende });
      TestBed.tick();
      expect(counts(http)).toEqual([]);
      expect(paramsOf(download(element)!.href)['radiuskm']).toBe('250');

      fixture.componentRef.setInput('event', { ...ende, time: ende.time + 3_600_000 });
      TestBed.tick();
      expect(paramsOf(onlyCount(http))['radiuskm']).toBe('100');
    });

    it('widens the circle, or lets it go for the whole world', async () => {
      const { element, http } = render({ event: ende });
      await answer(onlyCount(http), 312);

      choose(element, '250');
      expect(paramsOf(onlyCount(http))['radiuskm']).toBe('250');

      choose(element, 'The whole world');
      expect(Object.keys(paramsOf(onlyCount(http)))).toEqual(['from', 'to']);
    });
  });

  it('gets out of the way once the download starts', async () => {
    const { dialog, element, http } = render();
    await answer(onlyCount(http), 1994);
    // jsdom cannot follow the link; the browser's download manager would.
    element.addEventListener('click', (event) => event.preventDefault());

    download(element)!.click();
    TestBed.tick();

    expect(dialog.open()).toBe(false);
  });
});
