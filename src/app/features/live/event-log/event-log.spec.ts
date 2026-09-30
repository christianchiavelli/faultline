import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Quake, QuakeSummary } from '@shared/domain/quake';
import { aQuake } from '@shared/testing/quake-fixture';
import { EventLog, LATEST, parseMagnitudeFilter, type MagnitudeFilter } from './event-log';

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

async function render(filter: MagnitudeFilter) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(EventLog);
  fixture.componentRef.setInput('quakes', quakes);
  fixture.componentRef.setInput('filter', filter);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const rows = (element: HTMLElement) =>
  [...element.querySelectorAll('tbody tr:not(.day)')].map((row) => row.textContent ?? '');

describe('EventLog', () => {
  it('shows M2.5 and above by default, with a count on every filter', async () => {
    const element = await render(parseMagnitudeFilter(undefined));

    expect(rows(element)).toHaveLength(2);
    expect(
      [...element.querySelectorAll('nav a')].map((link) =>
        link.textContent?.replace(/\s+/g, ' ').trim(),
      ),
    ).toEqual(['All 4', 'M2.5+ 2', 'M4.5+ 1']);
    expect(element.querySelector('[aria-current="true"]')?.textContent).toContain('M2.5+');
  });

  it('capitalises places written to follow a magnitude', async () => {
    expect(rows(await render('4.5'))[0]).toContain('South of the Fiji Islands');
  });

  it('marks events that are not earthquakes, and provisional ones', async () => {
    const all = rows(await render('all'));

    expect(all.find((row) => row.includes('quarry blast'))).toBeDefined();
    expect(all.filter((row) => row.includes('Automatic'))).toHaveLength(1);
  });

  it('explains negative depths only when one is on screen', async () => {
    expect((await render('all')).textContent).toContain('above sea level');
    TestBed.resetTestingModule();
    expect((await render('4.5')).textContent).not.toContain('above sea level');
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
  { filter = 'all', unfolded = false }: { filter?: MagnitudeFilter; unfolded?: boolean } = {},
) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(EventLog);
  fixture.componentRef.setInput('quakes', day);
  fixture.componentRef.setInput('filter', filter);
  fixture.componentRef.setInput('unfolded', unfolded);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const text = (selector: string) =>
    element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  return { fixture, element, text };
}

describe('EventLog, folded', () => {
  it('folds a long list to its latest events, with a link to the rest in the address bar', async () => {
    const { element, text } = await renderLog(aDay(14));

    expect(rows(element)).toHaveLength(LATEST);
    expect(text('.more span')).toBe('The latest 10 of 14');
    expect(text('.more a')).toBe('Show all 14');
    expect(element.querySelector('.more a')?.getAttribute('href')).toBe('/?rows=all');
    expect(text('caption')).toBe(
      'Seismic events in the last 24 hours, newest first: the latest 10 of 14.',
    );
  });

  it('unfolds to every event, and links back to the latest', async () => {
    const { element, text } = await renderLog(aDay(14), { unfolded: true });

    expect(rows(element)).toHaveLength(14);
    expect(text('.more span')).toBe('All 14');
    expect(text('.more a')).toBe('Show only the latest 10');
    expect(element.querySelector('.more a')?.getAttribute('href')).toBe('/');
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
    fixture.componentRef.setInput('unfolded', true);
    TestBed.tick();

    expect((document.activeElement as HTMLElement).dataset['id']).toBe(`q${LATEST}`);
  });
});
