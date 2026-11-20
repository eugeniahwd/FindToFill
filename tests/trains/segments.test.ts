import { calculateHaversineDistance } from '@/lib/utils/geo';
import { SEGMENTS, STATION_COORDS, segmentPath } from '@/lib/trains/segments';

const KEYS = ['bogor:CW-TEB', 'bogor:TEB-MRI', 'bogor:CKI-MRI', 'cikarang:MTR-MRI', 'cikarang:MRI-SUD', 'cikarang:SUD-SUDB'];
const dist = (a: [number, number], b: [number, number]) => calculateHaversineDistance(a[0], a[1], b[0], b[1]);

describe('track segments around the pilot stations', () => {
  it.each(KEYS)('%s runs from one station to the other along the track', (key) => {
    const path = SEGMENTS[key];
    expect(path.length).toBeGreaterThanOrEqual(2);
    const [from, to] = key.split(':')[1].split('-');
    expect(dist(path[0], STATION_COORDS[from])).toBeLessThan(300);
    expect(dist(path[path.length - 1], STATION_COORDS[to])).toBeLessThan(300);
  });

  it('reverses a segment when asked the other way round', () => {
    expect(segmentPath('bogor', 'MRI', 'TEB')).toEqual([...SEGMENTS['bogor:TEB-MRI']].reverse());
    expect(segmentPath('bogor', 'TEB', 'MRI')).toEqual(SEGMENTS['bogor:TEB-MRI']);
  });

  it('returns null for an unknown segment', () => {
    expect(segmentPath('bogor', 'MRI', 'SUD')).toBeNull();
  });
});
