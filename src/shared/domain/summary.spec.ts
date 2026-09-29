import { aQuake } from '../testing/quake-fixture';
import { summarise } from './summary';

describe('summarise', () => {
  it('attributes almost all the energy to the largest event', () => {
    const summary = summarise([
      aQuake({ id: 'a', magnitude: { value: 6, type: 'mww' } }),
      aQuake({ id: 'b', magnitude: { value: 4, type: 'mb' } }),
      aQuake({ id: 'c', magnitude: { value: 4, type: 'mb' } }),
    ]);

    expect(summary.largest?.id).toBe('a');
    // One M6 against two M4s: 1000 / (1000 + 1 + 1).
    expect(summary.largestEnergyShare).toBeCloseTo(1000 / 1002, 6);
  });

  it('counts other seismic events but never lets them be the largest earthquake', () => {
    const summary = summarise([
      aQuake({ id: 'blast', kind: 'quarry blast', magnitude: { value: 5, type: 'ml' } }),
      aQuake({ id: 'quake', magnitude: { value: 2.1, type: 'md' } }),
    ]);

    expect(summary).toMatchObject({ total: 2, earthquakes: 1, otherEvents: 1 });
    expect(summary.largest?.id).toBe('quake');
    expect(summary.largestEnergyShare).toBe(1);
  });

  it('reports the reviewed share across every event', () => {
    const summary = summarise([
      aQuake({ id: 'a', review: 'reviewed' }),
      aQuake({ id: 'b', review: 'automatic' }),
      aQuake({ id: 'c', review: 'automatic' }),
      aQuake({ id: 'd', review: 'automatic' }),
    ]);

    expect(summary.reviewedShare).toBe(0.25);
  });

  it('treats a missing magnitude as unknown, not as zero', () => {
    const summary = summarise([aQuake({ magnitude: null })]);

    expect(summary.largest).toBeNull();
    expect(summary.largestEnergyShare).toBeNull();
    expect(summary.notable).toBe(0);
  });

  it('has nothing to say about an empty day', () => {
    expect(summarise([])).toMatchObject({
      total: 0,
      largest: null,
      largestEnergyShare: null,
      reviewedShare: null,
    });
  });
});
