import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Quake } from '@shared/domain/quake';
import { aQuake } from '@shared/testing/quake-fixture';
import { EventLog, parseMagnitudeFilter, type MagnitudeFilter } from './event-log';

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
      [...element.querySelectorAll('.filter')].map((link) =>
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
