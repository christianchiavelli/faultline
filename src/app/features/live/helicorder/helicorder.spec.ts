import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { QuakeSummary } from '@shared/domain/quake';
import { aQuake } from '@shared/testing/quake-fixture';
import { Helicorder } from './helicorder';

const NOW = Date.UTC(2026, 8, 29, 6, 30);
const HOUR = 3_600_000;

async function render(quakes: readonly QuakeSummary[]) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Helicorder);
  fixture.componentRef.setInput('quakes', quakes);
  fixture.componentRef.setInput('now', NOW);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('Helicorder', () => {
  it('draws 24 hourly lines, labelled in UTC, with the current hour marked', async () => {
    const element = await render([]);
    const hours = [...element.querySelectorAll('.hours li')];

    expect(element.querySelectorAll('path.ink')).toHaveLength(24);
    expect(hours[0]?.textContent?.trim()).toBe('07');
    expect(hours.at(-1)?.textContent?.trim()).toBe('06');
    expect(hours.at(-1)?.classList).toContain('hours__current');
  });

  it('labels the largest notable events, linked to their pages', async () => {
    const element = await render([
      aQuake({ id: 'big', time: NOW - 3 * HOUR, magnitude: { value: 6.1, type: 'mww' } }),
      aQuake({ id: 'small', time: NOW - 2 * HOUR, magnitude: { value: 3.2, type: 'ml' } }),
    ]);
    const markers = [...element.querySelectorAll<HTMLAnchorElement>('a.marker')];

    expect(markers).toHaveLength(1);
    expect(markers[0]?.textContent?.trim()).toBe('M6.1');
    expect(markers[0]?.getAttribute('href')).toBe('/quakes/big');
    expect(markers[0]?.getAttribute('aria-label')).toBe('M6.1 Mww, South Sandwich Islands region');
  });

  it('draws notable events in the pen, and only those', async () => {
    const element = await render([
      aQuake({ id: 'big', time: NOW - 3 * HOUR, magnitude: { value: 5.1, type: 'mb' } }),
      aQuake({ id: 'small', time: NOW - 2 * HOUR, magnitude: { value: 2.2, type: 'md' } }),
      aQuake({
        id: 'blast',
        time: NOW - HOUR,
        magnitude: { value: 4.8, type: 'ml' },
        kind: 'explosion',
      }),
    ]);

    expect(element.querySelectorAll('path.pen')).toHaveLength(1);
  });

  it('keeps the pen at the present, halfway along the last line', async () => {
    const pen = (await render([])).querySelector<HTMLElement>('.pen-head')!;

    expect(pen.style.left).toBe('50%');
  });
});
