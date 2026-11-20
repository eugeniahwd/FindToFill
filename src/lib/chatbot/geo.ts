/**
 * src/lib/chatbot/geo.ts
 *
 * Distance and walk time (the same formulas as src/lib/utils/geo.ts, so the Home page and the
 * chatbot show the same meters), and resolveLocation (docs/SPEC.md §4.2, docs/AI_CHATBOT.md
 * tool 1). The position stays on the server for this request only: tool results carry distances,
 * never coordinates.
 */

import { calculateHaversineDistance, calculateWalkTimeMinutes } from '../utils/geo';
import { STATION_DETECTION_RADIUS_M, WALKING_SPEED_MPS } from './config';
import type { StationRef } from './data/provider';

export interface Point {
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

export type DistanceBasis = 'user_position' | 'station_center';

export interface DetectedLocation {
  detected: true;
  /** gps: the position is within the detection radius of the station. manual: stationId only. */
  source: 'gps' | 'manual';
  station: StationRef;
  /** GPS is within the radius of more than one pilot station: the user should confirm. */
  needsConfirmation: boolean;
  distanceBasis: DistanceBasis;
  /** Where facility distances are measured from: the user's position or the station center. */
  origin: Point;
  /** From the user's position to the station center; null without a usable position. */
  distanceToStationM: number | null;
}

export type LocationResult =
  | DetectedLocation
  | { detected: false; reason: 'no_location' | 'unknown_station' | 'outside_pilot_area' };

export interface LocationInput {
  stationId?: string;
  position?: Point;
}

/**
 * - stationId (the user picked a station, or the app sends the one it shows) decides the
 *   station. Distances come from the GPS position when the user is within the detection radius
 *   of that station, otherwise from its center (approximate).
 * - GPS alone: the nearest pilot station within the radius; none within it asks the user to
 *   pick one (docs/SPEC.md §4.2).
 * - Neither: the user picks a station.
 */
export function resolveLocation(
  { stationId, position }: LocationInput,
  pilotStations: StationRef[],
  radiusM: number = STATION_DETECTION_RADIUS_M,
): LocationResult {
  if (stationId !== undefined) {
    const station = pilotStations.find((candidate) => candidate.id === stationId);
    if (!station) return { detected: false, reason: 'unknown_station' };
    const away = position ? distanceMeters(position, station) : null;
    if (position && away !== null && away <= radiusM) {
      const nearby = pilotStations.filter((s) => distanceMeters(position, s) <= radiusM);
      return fromGps(station, position, away, nearby.length > 1);
    }
    return {
      detected: true,
      source: 'manual',
      station,
      needsConfirmation: false,
      distanceBasis: 'station_center',
      origin: station,
      distanceToStationM: null,
    };
  }

  if (!position) return { detected: false, reason: 'no_location' };
  const nearby = pilotStations
    .map((station) => ({ station, away: distanceMeters(position, station) }))
    .filter((candidate) => candidate.away <= radiusM)
    .sort((a, b) => a.away - b.away);
  const nearest = nearby[0];
  if (!nearest) return { detected: false, reason: 'outside_pilot_area' };
  return fromGps(nearest.station, position, nearest.away, nearby.length > 1);
}

function fromGps(
  station: StationRef,
  position: Point,
  away: number,
  ambiguous: boolean,
): DetectedLocation {
  return {
    detected: true,
    source: 'gps',
    station,
    needsConfirmation: ambiguous,
    distanceBasis: 'user_position',
    origin: { latitude: position.latitude, longitude: position.longitude },
    distanceToStationM: away,
  };
}
