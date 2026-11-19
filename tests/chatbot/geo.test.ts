import type { StationRef } from '@/lib/chatbot/data/provider';
import { distanceMeters, resolveLocation, walkMinutes } from '@/lib/chatbot/geo';
import { calculateHaversineDistance } from '@/lib/utils/geo';

const MANGGARAI: StationRef = {
  id: 'station-manggarai',
  name: 'Manggarai',
  latitude: -6.21017,
  longitude: 106.84994,
};
const TEBET: StationRef = { id: 'station-tebet', name: 'Tebet', latitude: -6.2264, longitude: 106.85844 };
const PILOTS = [MANGGARAI, TEBET];

describe('distanceMeters and walkMinutes', () => {
  it('matches the shared Home page formula', () => {
    const facility = { latitude: -6.20977, longitude: 106.84994 };

    expect(distanceMeters(MANGGARAI, facility)).toBe(
      calculateHaversineDistance(MANGGARAI.latitude, MANGGARAI.longitude, -6.20977, 106.84994),
    );
    expect(distanceMeters(MANGGARAI, facility)).toBe(44);
  });

  it('is at least 1 minute and rounds up at 72 m per minute', () => {
    expect(walkMinutes(0)).toBe(1);
    expect(walkMinutes(45)).toBe(1);
    expect(walkMinutes(72)).toBe(1);
    expect(walkMinutes(73)).toBe(2);
    expect(walkMinutes(210)).toBe(3);
  });
});

describe('resolveLocation (GPS stays in the browser)', () => {
  it('uses a known pilot station, with distances from its center', () => {
    expect(resolveLocation('station-tebet', PILOTS)).toEqual({
      detected: true,
      source: 'manual',
      station: TEBET,
      needsConfirmation: false,
      distanceBasis: 'station_center',
    });
  });

  it('reports unknown_station for a well-formed id that is not a pilot station', () => {
    expect(resolveLocation('station-juanda', PILOTS)).toEqual({
      detected: false,
      reason: 'unknown_station',
    });
  });

  it('reports no_location when the request names no station', () => {
    expect(resolveLocation(undefined, PILOTS)).toEqual({ detected: false, reason: 'no_location' });
  });

  it('never matches when there are no pilot stations', () => {
    expect(resolveLocation('station-manggarai', [])).toEqual({
      detected: false,
      reason: 'unknown_station',
    });
  });
});
