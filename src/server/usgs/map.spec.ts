import { featureSchema, type UsgsFeature } from './schema';
import { preferredProduct, toOriginQuality, toQuake } from './map';

/** Shaped after a real record from the `all_day` feed. */
function aFeature(
  overrides: { properties?: object; coordinates?: (number | null)[] } = {},
): UsgsFeature {
  return featureSchema.parse({
    type: 'Feature',
    id: 'nc75444182',
    properties: {
      mag: 1.31,
      place: '2 km NNW of The Geysers, CA',
      time: 1790660593450,
      updated: 1790660691652,
      tz: null,
      url: 'https://earthquake.usgs.gov/earthquakes/eventpage/nc75444182',
      felt: null,
      cdi: null,
      mmi: null,
      alert: null,
      status: 'automatic',
      tsunami: 0,
      sig: 26,
      net: 'nc',
      code: '75444182',
      magType: 'md',
      type: 'earthquake',
      ...overrides.properties,
    },
    geometry: { type: 'Point', coordinates: overrides.coordinates ?? [-122.7626, 38.7938, 0.75] },
  });
}

describe('toQuake', () => {
  it('maps a feed record to the domain shape', () => {
    expect(toQuake(aFeature())).toEqual({
      id: 'nc75444182',
      time: 1790660593450,
      updated: 1790660691652,
      magnitude: { value: 1.31, type: 'md' },
      place: '2 km NNW of The Geysers, CA',
      location: { latitude: 38.7938, longitude: -122.7626, depthKm: 0.75 },
      review: 'automatic',
      kind: 'earthquake',
      network: 'nc',
      felt: null,
      alert: null,
      significance: 26,
      url: 'https://earthquake.usgs.gov/earthquakes/eventpage/nc75444182',
    });
  });

  it('keeps a negative depth: the event is above sea level, not a parsing error', () => {
    expect(toQuake(aFeature({ coordinates: [-155.2, 19.4, -1.2] }))?.location.depthKm).toBe(-1.2);
  });

  it('reports a magnitude without a type as missing, since it cannot be read', () => {
    expect(toQuake(aFeature({ properties: { magType: null } }))?.magnitude).toBeNull();
  });

  it('never claims a review that did not happen', () => {
    expect(toQuake(aFeature({ properties: { status: 'reviewed' } }))?.review).toBe('reviewed');
    expect(toQuake(aFeature({ properties: { status: 'something-new' } }))?.review).toBe(
      'automatic',
    );
  });

  it('drops deleted events', () => {
    expect(toQuake(aFeature({ properties: { status: 'deleted' } }))).toBeNull();
  });

  it('degrades an alert level it does not know to none instead of rejecting the record', () => {
    expect(toQuake(aFeature({ properties: { alert: 'purple' } }))?.alert).toBeNull();
  });
});

describe('origin quality', () => {
  it('reads the preferred origin, whose properties are all strings', () => {
    const origin = preferredProduct([
      { preferredWeight: 10, properties: { 'horizontal-error': '40' } },
      {
        preferredWeight: 158,
        properties: {
          'horizontal-error': '9.29',
          'vertical-error': '1.733',
          'num-stations-used': '81',
          'azimuthal-gap': '60',
          'depth-type': 'operator assigned',
        },
      },
    ]);

    expect(toOriginQuality(origin)).toEqual({
      horizontalErrorKm: 9.29,
      depthErrorKm: 1.733,
      stationsUsed: 81,
      azimuthalGapDeg: 60,
      depthType: 'operator assigned',
    });
  });

  it('turns empty or absent measurements into null, never into zero', () => {
    expect(toOriginQuality({ properties: { 'horizontal-error': '' } })).toMatchObject({
      horizontalErrorKm: null,
      stationsUsed: null,
    });
    expect(toOriginQuality(null)).toBeNull();
  });
});
