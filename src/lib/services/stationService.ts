import { Station, Facility, StationLayout, FacilityWithStatus } from '../types';
import { withDistances, type Coordinates } from '../utils/locator';
import { apiRequest, isMissing } from './apiClient';

// Distances are computed here in the browser, so GPS coordinates are never sent to the server.

export const stationService = {
  async getStations(): Promise<Station[]> {
    const { stations } = await apiRequest<{ stations: Station[] }>('/api/stations');
    return stations;
  },

  async getStationById(id: string): Promise<Station | null> {
    try {
      const { station } = await apiRequest<{ station: Station }>(`/api/stations/${encodeURIComponent(id)}`);
      return station;
    } catch (err) {
      if (isMissing(err)) return null;
      throw err;
    }
  },

  async getStationLayouts(stationId: string): Promise<StationLayout[]> {
    try {
      const { layouts } = await apiRequest<{ layouts: StationLayout[] }>(
        `/api/stations/${encodeURIComponent(stationId)}`,
      );
      return layouts;
    } catch (err) {
      if (isMissing(err)) return [];
      throw err;
    }
  },

  /** Active facilities with current status; adds distanceMeters/walkTimeMin when coords are given. */
  async getStationFacilities(
    stationId: string,
    userCoords?: Coordinates | null,
  ): Promise<FacilityWithStatus[]> {
    try {
      const { facilities } = await apiRequest<{ facilities: FacilityWithStatus[] }>(
        `/api/stations/${encodeURIComponent(stationId)}/facilities`,
      );
      return withDistances(facilities, userCoords ?? null);
    } catch (err) {
      if (isMissing(err)) return [];
      throw err;
    }
  },

  async getFacilityById(
    facilityId: string,
    userCoords?: Coordinates | null,
  ): Promise<FacilityWithStatus | null> {
    try {
      const { facility } = await apiRequest<{ facility: FacilityWithStatus }>(
        `/api/facilities/${encodeURIComponent(facilityId)}`,
      );
      return withDistances([facility], userCoords ?? null)[0];
    } catch (err) {
      if (isMissing(err)) return null;
      throw err;
    }
  },

  /** Admin only (checked by the API and RLS). */
  async updateFacility(facilityId: string, updates: Partial<Facility>): Promise<Facility> {
    const { facility } = await apiRequest<{ facility: Facility }>(
      `/api/admin/facilities/${encodeURIComponent(facilityId)}`,
      { method: 'PATCH', body: pickFacilityUpdates(updates) },
    );
    return facility;
  },

  /** Admin only (checked by the API and RLS). */
  async updateStation(stationId: string, updates: Partial<Station>): Promise<Station> {
    const { station } = await apiRequest<{ station: Station }>(
      `/api/admin/stations/${encodeURIComponent(stationId)}`,
      { method: 'PATCH', body: pickStationUpdates(updates) },
    );
    return station;
  },
};

// Only send editable fields; the API rejects anything else.
function pickFacilityUpdates(u: Partial<Facility>) {
  const { name, type, platform, locationDetail, level, latitude, longitude, layoutX, layoutY, isActive } = u;
  return { name, type, platform, locationDetail, level, latitude, longitude, layoutX, layoutY, isActive };
}

function pickStationUpdates(u: Partial<Station>) {
  const { name, lines, latitude, longitude, isPilot } = u;
  return { name, lines, latitude, longitude, isPilot };
}
