import { MAP_HEIGHT, MAP_WIDTH, equalEarth, toMap } from './equal-earth';

describe('Equal Earth', () => {
  it('matches the published extent of the projection', () => {
    expect(equalEarth(180, 0).x).toBeCloseTo(2.70663, 5);
    expect(equalEarth(0, 90).y).toBeCloseTo(1.317363, 6);
  });

  it('keeps the aspect ratio of the projection in the map frame', () => {
    expect(MAP_HEIGHT / MAP_WIDTH).toBeCloseTo(1.317363 / 2.70663, 4);
  });

  it('puts the origin in the middle and north at the top', () => {
    expect(toMap(0, 0)).toEqual({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
    expect(toMap(0, 90).y).toBeCloseTo(0, 6);
    expect(toMap(0, -90).y).toBeCloseTo(MAP_HEIGHT, 6);
  });

  it('draws the poles as lines about 59% of the equator, not as points', () => {
    const pole = toMap(180, 90).x - toMap(-180, 90).x;
    expect(pole / MAP_WIDTH).toBeCloseTo(0.5925, 3);
  });
});
