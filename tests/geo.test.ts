import {
  calculateHaversineDistance,
  formatDistance,
  calculateWalkTimeMinutes,
  findNearestStation,
} from '@/lib/utils/geo';
import { Station } from '@/lib/types';

describe('Geo Utilities', () => {
  describe('calculateHaversineDistance', () => {
    it('returns 0 when coordinates are identical', () => {
      const dist = calculateHaversineDistance(-6.2098, 106.8502, -6.2098, 106.8502);
      expect(dist).toBe(0);
    });

    it('calculates approximate distance between Manggarai and Tebet (~2 km)', () => {
      // Manggarai: -6.20988, 106.85018
      // Tebet: -6.22664, 106.85827
      const dist = calculateHaversineDistance(-6.20988, 106.85018, -6.22664, 106.85827);
      expect(dist).toBeGreaterThan(1800);
      expect(dist).toBeLessThan(2200);
    });
  });

  describe('formatDistance', () => {
    it('formats meters under 1000m with "m"', () => {
      expect(formatDistance(45)).toBe('45 m');
      expect(formatDistance(950)).toBe('950 m');
      expect(formatDistance(0)).toBe('0 m');
    });

    it('formats distances 1000m and above with "km"', () => {
      expect(formatDistance(1000)).toBe('1 km');
      expect(formatDistance(1240)).toBe('1.2 km');
      expect(formatDistance(2500)).toBe('2.5 km');
    });
  });

  describe('calculateWalkTimeMinutes', () => {
    it('returns at least 1 minute for small distances', () => {
      expect(calculateWalkTimeMinutes(10)).toBe(1);
    });

    it('calculates walk time using 1.2 m/s', () => {
      // 144 meters at 1.2 m/s = 120 seconds = 2 minutes
      expect(calculateWalkTimeMinutes(144)).toBe(2);
    });
  });

  describe('findNearestStation', () => {
    const stations: Station[] = [
      {
        id: 's1',
        name: 'Manggarai',
        lines: ['Bogor'],
        latitude: -6.20988,
        longitude: 106.85018,
        isPilot: true,
      },
      {
        id: 's2',
        name: 'Tebet',
        lines: ['Bogor'],
        latitude: -6.22664,
        longitude: 106.85827,
        isPilot: true,
      },
    ];

    it('identifies nearest station when standing right next to Manggarai', () => {
      const result = findNearestStation(-6.2099, 106.8502, stations);
      expect(result).not.toBeNull();
      expect(result?.station.name).toBe('Manggarai');
      expect(result?.isWithinRadius).toBe(true);
    });

    it('flags isWithinRadius as false when far from any station (>800m)', () => {
      // Far location in Bandung
      const result = findNearestStation(-6.9175, 107.6191, stations);
      expect(result).not.toBeNull();
      expect(result?.isWithinRadius).toBe(false);
    });
  });
});
