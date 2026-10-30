import {
  Station,
  Facility,
  StationLayout,
  FacilityWithStatus,
} from '../types';
import {
  MOCK_STATIONS,
  MOCK_FACILITIES,
  MOCK_LAYOUTS,
  MOCK_REPORTS,
} from '../mock/data';
import { resolveFacilityStatus } from '../utils/status';
import { calculateHaversineDistance, calculateWalkTimeMinutes } from '../utils/geo';

// In-memory mock store for dynamic updates during session
const dynamicStations: Station[] = [...MOCK_STATIONS];
const dynamicFacilities: Facility[] = [...MOCK_FACILITIES];

export const stationService = {
  // TODO(backend): Replace with supabase.from('stations').select('*').order('name')
  async getStations(): Promise<Station[]> {
    await new Promise((r) => setTimeout(r, 150));
    return [...dynamicStations];
  },

  // TODO(backend): Replace with supabase.from('stations').select('*').eq('id', id).single()
  async getStationById(id: string): Promise<Station | null> {
    await new Promise((r) => setTimeout(r, 100));
    const station = dynamicStations.find((s) => s.id === id);
    return station || null;
  },

  // TODO(backend): Replace with supabase.from('station_layouts').select('*').eq('station_id', stationId)
  async getStationLayouts(stationId: string): Promise<StationLayout[]> {
    await new Promise((r) => setTimeout(r, 100));
    return MOCK_LAYOUTS.filter((l) => l.stationId === stationId);
  },

  // TODO(backend): Replace with supabase.from('facility_status').select('*, facilities(*)')
  async getStationFacilities(
    stationId: string,
    userCoords?: { latitude: number; longitude: number } | null
  ): Promise<FacilityWithStatus[]> {
    await new Promise((r) => setTimeout(r, 200));
    const rawFacilities = dynamicFacilities.filter(
      (f) => f.stationId === stationId && f.isActive
    );

    return rawFacilities.map((fac) => {
      const facReports = MOCK_REPORTS.filter((r) => r.facilityId === fac.id);
      const { status, lastReportedAt, lastPhotoUrl, activeReportCount } =
        resolveFacilityStatus(facReports);

      let distanceMeters: number | undefined;
      let walkTimeMin: number | undefined;

      if (userCoords) {
        distanceMeters = calculateHaversineDistance(
          userCoords.latitude,
          userCoords.longitude,
          fac.latitude,
          fac.longitude
        );
        walkTimeMin = calculateWalkTimeMinutes(distanceMeters);
      }

      return {
        ...fac,
        currentStatus: status,
        lastReportedAt,
        lastPhotoUrl,
        distanceMeters,
        walkTimeMin,
        activeReportCount,
      };
    });
  },

  // TODO(backend): Replace with supabase query by facility id
  async getFacilityById(
    facilityId: string,
    userCoords?: { latitude: number; longitude: number } | null
  ): Promise<FacilityWithStatus | null> {
    await new Promise((r) => setTimeout(r, 150));
    const fac = dynamicFacilities.find((f) => f.id === facilityId);
    if (!fac) return null;

    const facReports = MOCK_REPORTS.filter((r) => r.facilityId === fac.id);
    const { status, lastReportedAt, lastPhotoUrl, activeReportCount } =
      resolveFacilityStatus(facReports);

    let distanceMeters: number | undefined;
    let walkTimeMin: number | undefined;

    if (userCoords) {
      distanceMeters = calculateHaversineDistance(
        userCoords.latitude,
        userCoords.longitude,
        fac.latitude,
        fac.longitude
      );
      walkTimeMin = calculateWalkTimeMinutes(distanceMeters);
    }

    return {
      ...fac,
      currentStatus: status,
      lastReportedAt,
      lastPhotoUrl,
      distanceMeters,
      walkTimeMin,
      activeReportCount,
    };
  },

  // TODO(backend): Replace with supabase.from('facilities').update(updates).eq('id', id)
  async updateFacility(
    facilityId: string,
    updates: Partial<Facility>
  ): Promise<Facility> {
    await new Promise((r) => setTimeout(r, 250));
    const index = dynamicFacilities.findIndex((f) => f.id === facilityId);
    if (index === -1) throw new Error('Facility not found');
    dynamicFacilities[index] = { ...dynamicFacilities[index], ...updates };
    return dynamicFacilities[index];
  },

  // TODO(backend): Replace with supabase.from('stations').update(updates).eq('id', id)
  async updateStation(
    stationId: string,
    updates: Partial<Station>
  ): Promise<Station> {
    await new Promise((r) => setTimeout(r, 250));
    const index = dynamicStations.findIndex((s) => s.id === stationId);
    if (index === -1) throw new Error('Station not found');
    dynamicStations[index] = { ...dynamicStations[index], ...updates };
    return dynamicStations[index];
  },
};
