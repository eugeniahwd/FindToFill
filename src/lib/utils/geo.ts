import { Station } from '../types';
import { APP_CONFIG } from '../config';

/**
 * Calculates the great-circle distance between two points in meters using the Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Formats a distance in meters to a readable string: "45 m" or "1.2 km".
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  // Format with at most 1 decimal place, e.g. "1.2 km"
  return `${km.toFixed(1).replace(/\.0$/, '')} km`;
}

/**
 * Estimates walking time in minutes based on configured walking speed (default 1.2 m/s).
 * Minimum 1 minute.
 */
export function calculateWalkTimeMinutes(
  distanceMeters: number,
  speedMps = APP_CONFIG.WALKING_SPEED_MPS
): number {
  const seconds = distanceMeters / speedMps;
  const minutes = Math.ceil(seconds / 60);
  return Math.max(1, minutes);
}

/**
 * Resolves the nearest station from a list of stations.
 */
export function findNearestStation(
  userLat: number,
  userLng: number,
  stations: Station[]
): { station: Station; distanceMeters: number; isWithinRadius: boolean } | null {
  if (!stations.length) return null;

  let nearestStation: Station = stations[0];
  let minDistance = Infinity;

  for (const station of stations) {
    const dist = calculateHaversineDistance(
      userLat,
      userLng,
      station.latitude,
      station.longitude
    );
    if (dist < minDistance) {
      minDistance = dist;
      nearestStation = station;
    }
  }

  return {
    station: nearestStation,
    distanceMeters: minDistance,
    isWithinRadius: minDistance <= APP_CONFIG.STATION_DETECTION_RADIUS_M,
  };
}
