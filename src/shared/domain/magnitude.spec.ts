import { energyRatio, expectedPerDay, magnitudeScale, radiatedEnergy } from './magnitude';

describe('magnitude', () => {
  it('grows energy about 32 times per whole step and about 1,000 times per two', () => {
    expect(energyRatio(6, 5)).toBeCloseTo(31.62, 2);
    expect(energyRatio(7, 5)).toBeCloseTo(1000, 6);
  });

  it('follows the Gutenberg-Richter relation in joules', () => {
    // log10 E = 1.5 M + 4.8, so an M6 radiates 10^13.8 J.
    expect(Math.log10(radiatedEnergy(6))).toBeCloseTo(13.8, 10);
  });

  it('names the scale behind a code, whatever its case', () => {
    expect(magnitudeScale('MWW')).toMatchObject({ code: 'Mww', family: 'moment' });
    expect(magnitudeScale('md')).toMatchObject({ code: 'Md', family: 'duration' });
    expect(magnitudeScale('mb_lg').code).toBe('mb_Lg');
  });

  it('expects the counted rate of M5s, about 1,300 a year', () => {
    expect(expectedPerDay(5, 6) * 365.25).toBeCloseTo(1319, 6);
  });

  it('expects ten times as many for each whole step down, as the USGS estimates', () => {
    expect(expectedPerDay(4, 5) / expectedPerDay(5, 6)).toBeCloseTo(10, 10);
    // The USGS table: 1,300,000 of M2 to 2.9 a year, estimated.
    expect(expectedPerDay(2, 3) * 365.25).toBeCloseTo(1_319_000, -3);
  });

  it('splits a step the way the law does, most of it in the smaller half', () => {
    const [lower, upper] = [expectedPerDay(5, 5.5), expectedPerDay(5.5, 6)];

    expect(lower + upper).toBeCloseTo(expectedPerDay(5, 6), 10);
    expect(lower / upper).toBeCloseTo(Math.sqrt(10), 10);
  });

  it('keeps an unknown code readable instead of guessing what it measures', () => {
    expect(magnitudeScale('mlv')).toEqual({ key: 'mlv', code: 'mlv', family: 'other' });
  });
});
