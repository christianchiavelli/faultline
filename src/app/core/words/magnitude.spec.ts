import { describeScale } from './magnitude';

describe('describeScale', () => {
  it('names a scale, says what it measures, and puts both in its title', () => {
    expect(describeScale('mww')).toEqual({
      key: 'mww',
      code: 'Mww',
      family: 'moment',
      name: 'Moment W-phase magnitude',
      summary:
        'From a moment tensor inversion of the W-phase. The authoritative USGS magnitude when it exists.',
      title:
        'Moment W-phase magnitude. From a moment tensor inversion of the W-phase. The authoritative USGS magnitude when it exists.',
    });
  });

  it('gives two codes of one method the same words', () => {
    expect(describeScale('ms_20').name).toBe(describeScale('ms').name);
  });

  it('keeps the code of a scale it does not know, and says whose it is', () => {
    expect(describeScale('mlv')).toMatchObject({
      code: 'mlv',
      family: 'other',
      name: 'Network-specific magnitude',
    });
  });
});
