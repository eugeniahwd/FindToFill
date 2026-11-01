import { filterFacilities, rankFacilities, sortByDistance, withDistances } from '@/lib/utils/locator';
import type { FacilityWithStatus } from '@/lib/types';

function facility(overrides: Partial<FacilityWithStatus>): FacilityWithStatus {
  return {
    id: 'f',
    stationId: 's',
    type: 'water',
    name: 'F',
    latitude: -6.2099,
    longitude: 106.8502,
    isActive: true,
    currentStatus: 'unknown',
    lastReportedAt: null,
    lastPhotoUrl: null,
    activeReportCount: 0,
    ...overrides,
  };
}

// About 111 m per 0.001 degree of latitude.
const origin = { latitude: -6.2099, longitude: 106.8502 };
const near = facility({ id: 'near', name: 'Near', latitude: -6.2094, currentStatus: 'broken' });
const mid = facility({ id: 'mid', name: 'Mid', type: 'charging', latitude: -6.2089, currentStatus: 'available' });
const far = facility({ id: 'far', name: 'Far', latitude: -6.2079, currentStatus: 'available' });

describe('withDistances', () => {
  it('adds distance in meters and walk time (min 1 minute)', () => {
    const [here, farAway] = withDistances([facility({ id: 'here' }), far], origin);
    expect(here.distanceMeters).toBe(0);
    expect(here.walkTimeMin).toBe(1);
    expect(farAway.distanceMeters).toBeGreaterThan(210);
    expect(farAway.distanceMeters).toBeLessThan(235);
    // 222 m / 1.2 m/s = 185 s -> 4 minutes (rounded up)
    expect(farAway.walkTimeMin).toBe(Math.ceil(farAway.distanceMeters! / 1.2 / 60));
  });

  it('clears distances when there is no location', () => {
    const [f] = withDistances([{ ...near, distanceMeters: 5, walkTimeMin: 1 }], null);
    expect(f.distanceMeters).toBeUndefined();
    expect(f.walkTimeMin).toBeUndefined();
  });
});

describe('filterFacilities', () => {
  const all = [near, mid, far];
  it.each([
    ['all', ['near', 'mid', 'far']],
    ['water', ['near', 'far']],
    ['charging', ['mid']],
    ['available', ['mid', 'far']],
  ] as const)('%s', (filter, ids) => {
    expect(filterFacilities(all, filter).map((f) => f.id)).toEqual(ids);
  });
});

describe('sortByDistance / rankFacilities', () => {
  it('sorts nearest first', () => {
    expect(rankFacilities([far, near, mid], origin).map((f) => f.id)).toEqual(['near', 'mid', 'far']);
  });

  it('combines filter and sort', () => {
    expect(rankFacilities([far, near, mid], origin, 'available').map((f) => f.id)).toEqual(['mid', 'far']);
  });

  it('puts facilities without a distance last, by name', () => {
    const sorted = sortByDistance([
      facility({ id: 'b', name: 'B' }),
      facility({ id: 'a', name: 'A' }),
      facility({ id: 'x', name: 'Z', distanceMeters: 10 }),
    ]);
    expect(sorted.map((f) => f.id)).toEqual(['x', 'a', 'b']);
  });

  it('does not mutate the input', () => {
    const input = [far, near];
    rankFacilities(input, origin);
    expect(input.map((f) => f.id)).toEqual(['far', 'near']);
  });
});
