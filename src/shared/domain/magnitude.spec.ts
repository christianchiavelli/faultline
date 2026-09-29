import { energyRatio, magnitudeScale, radiatedEnergy } from './magnitude';

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

  it('keeps an unknown code readable instead of guessing what it measures', () => {
    expect(magnitudeScale('mlv')).toEqual({
      code: 'mlv',
      name: 'Network-specific',
      family: 'other',
      summary: expect.any(String),
    });
  });
});
