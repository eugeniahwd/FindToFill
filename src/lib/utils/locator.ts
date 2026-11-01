import type { FacilityType, FacilityWithStatus } from '../types';
import { calculateHaversineDistance, calculateWalkTimeMinutes } from './geo';

// Pure locator logic shared by the browser (station list, map) and the server (chatbot tools).

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Same values as the Home page filter chips. */
export type FacilityFilter = 'all' | FacilityType | 'available';

/** Adds distanceMeters and walkTimeMin from the origin, or clears them when there is no origin. */
export function withDistances(
  facilities: FacilityWithStatus[],
  origin: Coordinates | null,
): FacilityWithStatus[] {
  return facilities.map((facility) => {
    if (!origin) return { ...facility, distanceMeters: undefined, walkTimeMin: undefined };
    const distanceMeters = calculateHaversineDistance(
      origin.latitude,
      origin.longitude,
      facility.latitude,
      facility.longitude,
    );
    return { ...facility, distanceMeters, walkTimeMin: calculateWalkTimeMinutes(distanceMeters) };
  });
}

export function filterFacilities(facilities: FacilityWithStatus[], filter: FacilityFilter): FacilityWithStatus[] {
  switch (filter) {
    case 'all':
      return facilities;
    case 'available':
      return facilities.filter((f) => f.currentStatus === 'available');
    default:
      return facilities.filter((f) => f.type === filter);
  }
}

/** Nearest first. Facilities without a distance go last, then by name for a stable order. */
export function sortByDistance(facilities: FacilityWithStatus[]): FacilityWithStatus[] {
  return [...facilities].sort((a, b) => {
    const da = a.distanceMeters ?? Number.POSITIVE_INFINITY;
    const db = b.distanceMeters ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.name.localeCompare(b.name);
  });
}

export function rankFacilities(
  facilities: FacilityWithStatus[],
  origin: Coordinates | null,
  filter: FacilityFilter = 'all',
): FacilityWithStatus[] {
  return sortByDistance(filterFacilities(withDistances(facilities, origin), filter));
}
