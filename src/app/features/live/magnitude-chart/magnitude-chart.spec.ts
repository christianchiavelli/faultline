import { TestBed } from '@angular/core/testing';
import type { QuakeSummary } from '@shared/domain/quake';
import { aQuake } from '@shared/testing/quake-fixture';
import { MagnitudeChart } from './magnitude-chart';

async function render(quakes: readonly QuakeSummary[]) {
  const fixture = TestBed.createComponent(MagnitudeChart);
  fixture.componentRef.setInput('quakes', quakes);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

function quake(id: string, value: number) {
  return aQuake({ id, magnitude: { value, type: 'ml' } });
}

const day = [
  quake('nc1', 1.1),
  quake('nc2', 1.3),
  quake('ak1', 1.2),
  quake('pr1', 2.8),
  quake('us1', 4.6),
  quake('us2', 6.1),
];

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim();

describe('MagnitudeChart', () => {
  it('draws a bar for each size with events, and says how many', async () => {
    const element = await render(day);

    expect(element.querySelectorAll('rect.bar')).toHaveLength(4);
    expect(element.querySelectorAll('rect.bar--pen')).toHaveLength(2);
    expect([...element.querySelectorAll('.count:not(.count--zero)')].map(text)).toEqual([
      '3',
      '1',
      '1',
      '1',
    ]);
  });

  it('says where the small ones come from, and how many the gap between networks misses', async () => {
    const element = await render(day);

    expect(text(element.querySelector('.note--centred'))).toBe(
      'Where seismometers are dense California and Alaska, mostly',
    );
    expect(text(element.querySelector('.note--gap'))).toBe(
      'Mostly missing 1 located, where an average day has about 1,300',
    );
  });

  it('is a picture for the eye, and a table for a screen reader', async () => {
    const element = await render(day);
    const rows = [...element.querySelectorAll('table tbody tr')].map((row) =>
      [...row.children].map(text),
    );

    expect(element.querySelector('.plot')?.getAttribute('aria-hidden')).toBe('true');
    expect(rows[0]).toEqual(['M1 to 1.5', '3', '—']);
    expect(rows).toContainEqual(['M4.5 to 5', '1', '8.7']);
    expect(rows.at(-1)).toEqual(['M6 to 6.5', '1', '0.27']);
  });

  it('writes a magnitude below zero with a minus sign', async () => {
    const element = await render([quake('hv1', -0.4)]);

    expect(text(element.querySelector('.plot__magnitudes span'))).toBe('−2');
    expect(text(element.querySelector('table tbody th'))).toBe('M−0.5 to 0');
  });
});
