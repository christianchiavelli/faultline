import { networkName, regionOf } from './network';

describe('network', () => {
  it('names a contributing network, whatever the case of its code', () => {
    expect(networkName('AK')).toBe('Alaska Earthquake Center');
    expect(networkName('zz')).toBeNull();
  });

  it('reads the region an event comes from off its id', () => {
    expect(regionOf('nc75012345')).toBe('california');
    expect(regionOf('ci40123456')).toBe('california');
    expect(regionOf('av91234567')).toBe('alaska');
  });

  it('gives the global network and unknown ones no region', () => {
    expect(regionOf('us7000q1ab')).toBeNull();
    expect(regionOf('zz0001')).toBeNull();
  });
});
