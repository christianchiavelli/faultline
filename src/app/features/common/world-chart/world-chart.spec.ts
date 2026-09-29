import { TestBed } from '@angular/core/testing';
import { MAP_WIDTH } from '@shared/geo/equal-earth';
import { aQuake } from '@shared/testing/quake-fixture';
import { WorldChart, dotRadius } from './world-chart';

const svalbard = aQuake({
  id: 'north',
  magnitude: { value: 5.4, type: 'mww' },
  location: { latitude: 82.6, longitude: -7.2, depthKm: 10 },
});
const california = aQuake({
  id: 'west',
  magnitude: { value: 1.3, type: 'md' },
  location: { latitude: 38.8, longitude: -122.8, depthKm: 0.8 },
});

async function render(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(WorldChart);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  await fixture.whenStable();
  return { element: fixture.nativeElement as HTMLElement, chart: fixture.componentInstance };
}

describe('WorldChart', () => {
  it('draws one dot per event, largest first so the small ones stay on top', async () => {
    const { element } = await render({ quakes: [california, svalbard] });
    const dots = [...element.querySelectorAll('circle.dot')].filter(
      (dot) => !dot.closest('.legend'),
    );

    expect(dots).toHaveLength(2);
    expect(Number(dots[0]!.getAttribute('r'))).toBeGreaterThan(Number(dots[1]!.getAttribute('r')));
    expect(dots[0]!.classList).toContain('dot--notable');
  });

  it('frames a zoomed map around the focus without leaving the map', async () => {
    const { chart, element } = await render({ quakes: [svalbard], focus: 'north', zoom: 2.5 });

    expect(chart.frame().width).toBeCloseTo(MAP_WIDTH / 2.5, 0);
    // So far north that the window is pushed down to the map's edge rather than past it.
    expect(chart.frame().y).toBe(0);
    expect(element.querySelector('.focus-ring')).not.toBeNull();
  });

  it('keeps dots the same size on screen when magnified', async () => {
    const { element } = await render({ quakes: [svalbard], focus: 'north', zoom: 2 });
    const dot = element.querySelector('circle.dot')!;

    expect(Number(dot.getAttribute('r'))).toBeCloseTo(dotRadius(5.4) / 2, 1);
  });

  it('can leave the legend out', async () => {
    const { element } = await render({ quakes: [svalbard], showLegend: false });

    expect(element.querySelector('.legend')).toBeNull();
  });
});
