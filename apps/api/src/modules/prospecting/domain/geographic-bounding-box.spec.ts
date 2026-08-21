import {
  parseNominatimBoundingBox,
  toGoogleLocationRestriction,
} from './geographic-bounding-box';

describe('geographic-bounding-box', () => {
  it('parses Nominatim south,north,west,east order', () => {
    expect(parseNominatimBoundingBox(['-3.6849083', '-3.2631108', '-62.0879000', '-61.2791861'])).toEqual({
      south: -3.6849083,
      north: -3.2631108,
      west: -62.0879,
      east: -61.2791861,
    });
  });

  it('builds a Google rectangle that still excludes Manaus for Anamã', () => {
    const restriction = toGoogleLocationRestriction({
      south: -3.6849083,
      north: -3.2631108,
      west: -62.0879,
      east: -61.2791861,
    });
    const { low, high } = restriction.rectangle;
    expect(low.latitude).toBeLessThan(high.latitude);
    expect(low.longitude).toBeLessThan(high.longitude);
    const manaus = { latitude: -3.119, longitude: -60.021 };
    expect(manaus.latitude).toBeGreaterThan(high.latitude);
    expect(manaus.longitude).toBeGreaterThan(high.longitude);
  });
});
