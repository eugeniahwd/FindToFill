import type { StationRef } from '@/lib/chatbot/data/provider';
import { distanceMeters, resolveLocation, walkMinutes } from '@/lib/chatbot/geo';
import { calculateHaversineDistance } from '@/lib/utils/geo';

const MANGGARAI: StationRef = {
  id: 'station-manggarai',
  name: 'Manggarai',
  latitude: -6.21017,
  longitude: 106.84994,
};
const TEBET: StationRef = {
  id: 'station-tebet',
  name: 'Tebet',
  latitude: -6.2264,
  longitude: 106.85844,
};
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

// 44 m north of the Manggarai center (see the distance test above).
const AT_MANGGARAI = { latitude: -6.20977, longitude: 106.84994 };
// About 635 m from Manggarai and 1.4 km from Tebet.
const BETWEEN = { latitude: -6.215, longitude: 106.853 };
// Depok, about 20 km from both.
const FAR_AWAY = { latitude: -6.4025, longitude: 106.7942 };

describe('resolveLocation with a GPS position', () => {
  it('finds the nearest pilot station and measures from the user', () => {
    expect(resolveLocation({ position: AT_MANGGARAI }, PILOTS)).toEqual({
      detected: true,
      source: 'gps',
      station: MANGGARAI,
      needsConfirmation: false,
      distanceBasis: 'user_position',
      origin: AT_MANGGARAI,
      distanceToStationM: 44,
    });
  });

  it('reports outside_pilot_area beyond the 800 m radius', () => {
    expect(resolveLocation({ position: FAR_AWAY }, PILOTS)).toEqual({
      detected: false,
      reason: 'outside_pilot_area',
    });
  });

  it('includes the radius boundary itself', () => {
    expect(resolveLocation({ position: AT_MANGGARAI }, PILOTS, 44)).toMatchObject({
      detected: true,
    });
    expect(resolveLocation({ position: AT_MANGGARAI }, PILOTS, 43)).toEqual({
      detected: false,
      reason: 'outside_pilot_area',
    });
  });

  it('asks to confirm when more than one pilot station is within the radius', () => {
    expect(resolveLocation({ position: BETWEEN }, PILOTS)).toMatchObject({
      station: MANGGARAI,
      needsConfirmation: false,
    });
    expect(resolveLocation({ position: BETWEEN }, PILOTS, 2000)).toMatchObject({
      station: MANGGARAI,
      needsConfirmation: true,
    });
  });
});

describe('resolveLocation with a stationId', () => {
  it('uses a picked pilot station, with distances from its center', () => {
    expect(resolveLocation({ stationId: 'station-tebet' }, PILOTS)).toEqual({
      detected: true,
      source: 'manual',
      station: TEBET,
      needsConfirmation: false,
      distanceBasis: 'station_center',
      origin: TEBET,
      distanceToStationM: null,
    });
  });

  it('measures from the user when the user is at the picked station', () => {
    expect(
      resolveLocation({ stationId: 'station-manggarai', position: AT_MANGGARAI }, PILOTS),
    ).toMatchObject({ source: 'gps', distanceBasis: 'user_position', origin: AT_MANGGARAI });
  });

  it('measures from the station center when the user is far from the picked station', () => {
    // For example a demo on campus: "3 km from you" would mean nothing for a refill.
    expect(
      resolveLocation({ stationId: 'station-manggarai', position: FAR_AWAY }, PILOTS),
    ).toMatchObject({
      source: 'manual',
      station: MANGGARAI,
      distanceBasis: 'station_center',
      origin: MANGGARAI,
    });
  });

  it('lets the picked station win over a GPS position at another pilot station', () => {
    expect(
      resolveLocation({ stationId: 'station-tebet', position: AT_MANGGARAI }, PILOTS),
    ).toMatchObject({ station: TEBET, distanceBasis: 'station_center' });
  });

  it('reports unknown_station for a well-formed id that is not a pilot station', () => {
    expect(
      resolveLocation({ stationId: 'station-juanda', position: AT_MANGGARAI }, PILOTS),
    ).toEqual({ detected: false, reason: 'unknown_station' });
  });
});

describe('resolveLocation without a location', () => {
  it('reports no_location', () => {
    expect(resolveLocation({}, PILOTS)).toEqual({ detected: false, reason: 'no_location' });
  });

  it('never matches when there are no pilot stations', () => {
    expect(resolveLocation({ stationId: 'station-manggarai' }, [])).toEqual({
      detected: false,
      reason: 'unknown_station',
    });
    expect(resolveLocation({ position: AT_MANGGARAI }, [])).toEqual({
      detected: false,
      reason: 'outside_pilot_area',
    });
  });
});
