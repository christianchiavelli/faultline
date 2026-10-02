import { expectedPerDay } from '@shared/domain/magnitude';
import { aQuake } from '@shared/testing/quake-fixture';
import { distribution } from './distribution';

function quake(id: string, value: number) {
  return aQuake({ id, magnitude: { value, type: 'ml' } });
}

const countAt = (chart: ReturnType<typeof distribution>, from: number) =>
  chart.bins.find((bin) => bin.from === from)?.count;

describe('distribution', () => {
  it('counts the earthquakes in half-magnitude steps, and nothing else', () => {
    const chart = distribution([
      quake('nc1', 1.2),
      quake('nc2', 1.4),
      quake('ak1', 1.5),
      quake('us1', 4.5),
      quake('us2', 4.99),
      aQuake({ id: 'blast', magnitude: { value: 1.3, type: 'ml' }, kind: 'quarry blast' }),
      aQuake({ id: 'fresh', magnitude: null }),
    ]);

    expect(countAt(chart, 1)).toBe(2);
    expect(countAt(chart, 1.5)).toBe(1);
    expect(countAt(chart, 4.5)).toBe(2);
    expect(chart.bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(5);
  });

  it('spans M−2 to M8 on an ordinary day, and stretches for an extraordinary one', () => {
    expect(distribution([]).bins).toHaveLength(20);

    const extraordinary = distribution([quake('us1', 8.8), quake('hv1', -2.3)]);
    expect([extraordinary.from, extraordinary.to]).toEqual([-3, 9]);
    expect(countAt(extraordinary, 8.5)).toBe(1);
  });

  it('draws the law as one straight line, a power of ten per magnitude', () => {
    const { law } = distribution([]);
    const slope = (law.y2 - law.y1) / (law.x2 - law.x1);
    // Across, a magnitude is a tenth of M−2 to M8; down, a power of ten is a fifth of the scale.
    expect(slope).toBeCloseTo(20 / 10, 9);

    // It passes through an average day's M5 to 5.5, drawn at the middle of that bin.
    const x = ((5.25 + 2) / 10) * 100;
    const y = law.y1 + (x - law.x1) * slope;
    expect(y).toBeCloseTo(((4 - Math.log10(expectedPerDay(5, 5.5))) / 5) * 100, 9);
  });

  it('draws in the pen only the sizes the catalogue holds worldwide', () => {
    const chart = distribution([quake('us1', 4.4), quake('us2', 4.5)]);

    expect(chart.bins.filter((bin) => bin.worldwide).map((bin) => bin.from)[0]).toBe(4.5);
    expect(chart.bins.find((bin) => bin.from === 4)?.worldwide).toBe(false);
  });

  it('counts an empty size aloud between the smallest and the largest, and while the law is on the paper', () => {
    const chart = distribution([quake('nc1', 1.2), quake('us1', 4.6)]);
    const labelled = chart.bins.filter((bin) => bin.labelled).map((bin) => bin.from);

    // An average day has 0.27 of M6 to 6.5, still on the paper, and 0.09 of the next, off it.
    expect(labelled).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6]);
    expect(chart.bins.find((bin) => bin.from === 3)).toMatchObject({ count: 0, y: 100 });
  });

  it('leaves the law off where it runs above the paper', () => {
    const chart = distribution([]);

    expect(chart.bins.find((bin) => bin.from === 1)?.expected).toBeNull();
    expect(chart.bins.find((bin) => bin.from === 4.5)?.expected).toBeCloseTo(8.68, 2);
  });

  it('holds what the catalogue located between the networks against an average day', () => {
    const chart = distribution([quake('pr1', 2.8), quake('ak1', 3.4), quake('us1', 4.6)]);

    expect(chart.gap.located).toBe(2);
    expect(chart.gap.expected).toBeCloseTo(1256, 0);
  });

  it('names the regions behind the small events, busiest first', () => {
    const chart = distribution([
      quake('nc1', 1.1),
      quake('ci1', 1.2),
      quake('nc2', 0.8),
      quake('ak1', 1.3),
      quake('av1', 1.4),
      quake('hv1', 2),
      quake('uu1', 0.5),
      quake('us1', 1.5),
      quake('tx1', 3),
    ]);

    expect(chart.dense?.regions).toEqual(['california', 'alaska', 'hawaii']);
    expect(chart.dense?.x).toBe(chart.bins.find((bin) => bin.from === 1)?.x);
  });

  it('names no hump when no regional network caught anything small', () => {
    expect(distribution([quake('us1', 1.5)]).dense).toBeNull();
    expect(distribution([quake('us1', 5)]).dense).toBeNull();
  });
});
