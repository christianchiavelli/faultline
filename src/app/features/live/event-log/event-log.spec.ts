import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Quake, QuakeSummary } from '@shared/domain/quake';
import { aQuake } from '@shared/testing/quake-fixture';
import { EventLog, LATEST } from './event-log';
import { parseLogQuery, type LogQuery, type MagnitudeFloor } from './log-query';

const at = (magnitude: MagnitudeFloor, unfolded = false): LogQuery => ({ magnitude, unfolded });

const quakes: Quake[] = [
  aQuake({ id: 'big', magnitude: { value: 5.3, type: 'mww' }, place: 'south of the Fiji Islands' }),
  aQuake({ id: 'mid', magnitude: { value: 3.1, type: 'ml' }, review: 'automatic' }),
  aQuake({
    id: 'small',
    magnitude: { value: 1.2, type: 'md' },
    location: { latitude: 19.4, longitude: -155.3, depthKm: -1.2 },
  }),
  aQuake({ id: 'blast', magnitude: { value: 1.9, type: 'md' }, kind: 'quarry blast' }),
];

async function render(query: LogQuery) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(EventLog);
  fixture.componentRef.setInput('quakes', quakes);
  fixture.componentRef.setInput('query', query);
  fixture.componentRef.setInput('now', quakes[0]!.time + 2 * 3_600_000);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const rows = (element: HTMLElement) =>
  [...element.querySelectorAll('tbody tr:not(.day)')].map((row) => row.textContent ?? '');

describe('EventLog', () => {
  it('shows M2.5 and above by default, with a count on every filter', async () => {
    const element = await render(parseLogQuery({}));

    expect(rows(element)).toHaveLength(2);
    expect(
      [...element.querySelectorAll('nav a')].map((link) =>
        link.textContent?.replace(/\s+/g, ' ').trim(),
      ),
    ).toEqual(['All 4', 'M2.5+ 2', 'M4.5+ 1']);
    expect(element.querySelector('[aria-current="true"]')?.textContent).toContain('M2.5+');
  });

  it('splits the place into locality and region, and gives the position', async () => {
    const element = await render(at('any'));
    const row = element.querySelector('tbody tr:not(.day)')!;
    const cell = (name: string) =>
      row.querySelector(name)?.textContent?.replace(/\s+/g, ' ').trim();

    expect(cell('.place a')).toBe('South of the Fiji Islands');
    expect(cell('.region')).toBe('South of the Fiji Islands');
    expect(cell('.position')).toBe('58.10° S 25.40° W');
    expect(cell('.ago')).toBe('2 h ago');
    expect(row.querySelector('time')?.getAttribute('datetime')).toBe('2026-09-29T04:16:27.000Z');
  });

  it('draws the magnitude with the dot the map uses, in the pen when notable', async () => {
    const element = await render(at('any'));
    const [big, mid] = [...element.querySelectorAll('tbody tr:not(.day) .magnitude')];

    expect(big?.classList).toContain('magnitude--notable');
    expect(mid?.classList).not.toContain('magnitude--notable');
    const size = (cell: Element | undefined) =>
      parseFloat(cell!.querySelector<HTMLElement>('.dot')!.style.getPropertyValue('--dot'));
    expect(size(big)).toBeGreaterThan(size(mid));
  });

  it('capitalises places written to follow a magnitude', async () => {
    expect(rows(await render(at('4.5')))[0]).toContain('South of the Fiji Islands');
  });

  it('marks events that are not earthquakes, and provisional ones', async () => {
    const all = rows(await render(at('any')));

    expect(all.find((row) => row.includes('quarry blast'))).toBeDefined();
    expect(all.filter((row) => row.includes('Automatic'))).toHaveLength(1);
  });

  it('explains negative depths only when one is on screen', async () => {
    expect((await render(at('any'))).textContent).toContain('above sea level');
    TestBed.resetTestingModule();
    expect((await render(at('4.5'))).textContent).not.toContain('above sea level');
  });
});

const NOW = Date.UTC(2026, 8, 29, 6, 30);

/** A day of the given length, newest first, the order the feed comes in. */
function aDay(length: number): Quake[] {
  return Array.from({ length }, (_, i) =>
    aQuake({ id: `q${i}`, time: NOW - i * 600_000, magnitude: { value: 3, type: 'ml' } }),
  );
}

async function renderLog(
  day: readonly QuakeSummary[],
  { magnitude = 'any', unfolded = false }: { magnitude?: MagnitudeFloor; unfolded?: boolean } = {},
) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(EventLog);
  fixture.componentRef.setInput('quakes', day);
  fixture.componentRef.setInput('query', at(magnitude, unfolded));
  fixture.componentRef.setInput('now', NOW);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const text = (selector: string) =>
    element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const firstRow = () =>
    element.querySelector('tbody tr:not(.day) .place a')?.getAttribute('data-id');
  return { fixture, element, text, firstRow };
}

describe('EventLog, folded', () => {
  it('folds a long list to its latest events, with a link to the rest in the address bar', async () => {
    const { element, text } = await renderLog(aDay(14));

    expect(rows(element)).toHaveLength(LATEST);
    expect(text('.more span')).toBe('The latest 10 of 14');
    expect(text('.more a')).toBe('Show all 14');
    expect(element.querySelector('.more a')?.getAttribute('href')).toBe('/?mag=any&rows=all');
    expect(text('caption')).toBe(
      'Seismic events in the last 24 hours, newest first: the latest 10 of 14.',
    );
  });

  it('unfolds to every event, and links back to the latest', async () => {
    const { element, text } = await renderLog(aDay(14), { unfolded: true });

    expect(rows(element)).toHaveLength(14);
    expect(text('.more span')).toBe('All 14');
    expect(text('.more a')).toBe('Show only the latest 10');
    expect(element.querySelector('.more a')?.getAttribute('href')).toBe('/?mag=any');
  });

  it('has nothing to fold when the list fits', async () => {
    const { element } = await renderLog(aDay(LATEST));

    expect(element.querySelector('.more')).toBeNull();
  });

  it('moves focus to the first row it adds when unfolding', async () => {
    const { fixture, element } = await renderLog(aDay(14));

    element
      .querySelector<HTMLAnchorElement>('.more a')!
      .dispatchEvent(new MouseEvent('click', { button: 0, bubbles: true, cancelable: true }));
    fixture.componentRef.setInput('query', at('any', true));
    TestBed.tick();

    expect((document.activeElement as HTMLElement).dataset['id']).toBe(`q${LATEST}`);
  });
});

const arrival = aQuake({ id: 'new', time: NOW + 60_000, magnitude: { value: 4.1, type: 'mb' } });

/** jsdom has no IntersectionObserver. This one reports the log with its top at `top` px. */
function logAt(top: number) {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private readonly report: IntersectionObserverCallback) {}
      observe() {
        const entry = { boundingClientRect: { top }, rootBounds: { height: 800 } };
        this.report([entry as unknown as IntersectionObserverEntry], this as never);
      }
      readonly disconnect = vi.fn();
    },
  );
}

describe('EventLog, live', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('holds a new event that lands in view, and shows it when asked, focused and tinted', async () => {
    logAt(120);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { fixture, element, text, firstRow } = await renderLog(aDay(12));

    fixture.componentRef.setInput('quakes', [arrival, ...aDay(12)]);
    TestBed.tick();

    // Nothing moved: not the rows, not the counts.
    expect(firstRow()).toBe('q0');
    expect(rows(element)).toHaveLength(LATEST);
    expect(text('nav a')).toBe('All 12');
    expect(text('[role="status"]')).toBe('1 new event Show it');

    element.querySelector<HTMLButtonElement>('[role="status"] button')!.click();
    TestBed.tick();

    expect(element.querySelector('[role="status"]')?.textContent?.trim()).toBe('');
    expect(text('nav a')).toBe('All 13');
    const row = element.querySelector('tbody tr:not(.day)')!;
    expect(row.classList).toContain('row--fresh');
    expect((document.activeElement as HTMLElement).dataset['id']).toBe('new');

    vi.advanceTimersByTime(4_000);
    TestBed.tick();
    expect(row.classList).not.toContain('row--fresh');
  });

  it('lets a new event straight in while the log is still below the fold', async () => {
    logAt(2_400);
    const { fixture, element, firstRow } = await renderLog(aDay(12));

    fixture.componentRef.setInput('quakes', [arrival, ...aDay(12)]);
    TestBed.tick();

    expect(firstRow()).toBe('new');
    expect(element.querySelector('.fresh')).toBeNull();
  });

  it('only calls out held events the filter would show, and lets them in with a new filter', async () => {
    logAt(0);
    const small = aQuake({ id: 'new', time: NOW + 60_000, magnitude: { value: 1.1, type: 'md' } });
    const { fixture, element } = await renderLog(aDay(12), { magnitude: '2.5' });

    fixture.componentRef.setInput('quakes', [small, ...aDay(12)]);
    TestBed.tick();
    expect(element.querySelector('.fresh')).toBeNull();

    fixture.componentRef.setInput('query', at('any'));
    TestBed.tick();
    expect(element.querySelector('[data-id="new"]')).not.toBeNull();
    expect(element.querySelector('.fresh')).toBeNull();
  });
});
