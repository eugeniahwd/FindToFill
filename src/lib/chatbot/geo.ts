/**
 * src/lib/chatbot/geo.ts
 *
 * Distance and walk time (the same formulas as src/lib/utils/geo.ts, so the Home page and the
 * chatbot show the same meters), and resolveLocation (docs/AI_TRACK.md §7, tool 1).
 */

import { calculateHaversineDistance, calculateWalkTimeMinutes } from '../utils/geo';
import { WALKING_SPEED_MPS } from './config';
import type { StationRef } from './data/provider';

interface Point {
  latitude: number;
  longitude: number;
}

/** Whole meters between two points (haversine). */
export function distanceMeters(from: Point, to: Point): number {
  return calculateHaversineDistance(from.latitude, from.longitude, to.latitude, to.longitude);
}

/** max(1, ceil(distance / walking meters per minute)). */
export function walkMinutes(distanceM: number): number {
  return calculateWalkTimeMinutes(distanceM, WALKING_SPEED_MPS);
}

export type LocationResult =
  | {
      detected: true;
      source: 'manual';
      station: StationRef;
      needsConfirmation: false;
      distanceBasis: 'station_center';
    }
  | { detected: false; reason: 'no_location' | 'unknown_station' };

/**
 * GPS stays in the browser: the request only names a station. A known pilot station is used
 * as is, with distances from its center. Anything else asks the user to pick a station.
 */
export function resolveLocation(
  stationId: string | undefined,
  pilotStations: StationRef[],
): LocationResult {
  if (stationId === undefined) return { detected: false, reason: 'no_location' };
  const station = pilotStations.find((candidate) => candidate.id === stationId);
  if (!station) return { detected: false, reason: 'unknown_station' };
  return {
    detected: true,
    source: 'manual',
    station,
    needsConfirmation: false,
    distanceBasis: 'station_center',
  };
}
