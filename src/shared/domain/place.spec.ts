import { regionSlug, splitPlace } from './place';

describe('splitPlace', () => {
  it('splits a locality from the region after the last comma', () => {
    expect(splitPlace('48 km WNW of Luwuk, Indonesia')).toEqual({
      locality: '48 km WNW of Luwuk',
      region: 'Indonesia',
    });
    expect(splitPlace('10 km SW of Guadalupe Victoria, B.C., MX')).toEqual({
      locality: '10 km SW of Guadalupe Victoria, B.C.',
      region: 'Mexico',
    });
  });

  it('spells out the regions the Californian networks write as codes', () => {
    expect(splitPlace('6 km NW of The Geysers, CA').region).toBe('California');
  });

  it('reads a place with no locality as its region alone', () => {
    expect(splitPlace('Balleny Islands region')).toEqual({
      locality: null,
      region: 'Balleny Islands',
    });
    expect(splitPlace('south of the Fiji Islands')).toEqual({
      locality: null,
      region: 'south of the Fiji Islands',
    });
  });

  it('has neither for an event with no place name', () => {
    expect(splitPlace(null)).toEqual({ locality: null, region: null });
    expect(splitPlace('  ')).toEqual({ locality: null, region: null });
  });
});

describe('regionSlug', () => {
  it('writes a region the way an address bar reads it', () => {
    expect(regionSlug('U.S. Virgin Islands')).toBe('us-virgin-islands');
    expect(regionSlug('Papua New Guinea')).toBe('papua-new-guinea');
    expect(regionSlug('Côte d’Ivoire')).toBe('cote-d-ivoire');
    expect(regionSlug('south of the Fiji Islands')).toBe('south-of-the-fiji-islands');
  });
});
