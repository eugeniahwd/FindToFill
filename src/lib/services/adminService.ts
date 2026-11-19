import type {
  Facility,
  FacilityWithStatus,
  ModerationReport,
  ModerationReview,
  RemovalResult,
  ReportStatus,
  Schedule,
  Station,
} from '../types';
import { apiRequest } from './apiClient';

// Admin page calls. Every route checks the admin role on the server and again with RLS,
// so hiding the page from commuters is only a convenience, not the protection.

export type DayType = Schedule['dayType'];

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

const id = (value: string) => encodeURIComponent(value);

export interface NewStation {
  name: string;
  lines: string[];
  latitude: number;
  longitude: number;
}

export interface NewFacility {
  stationId: string;
  type: Facility['type'];
  name: string;
  platform?: string;
  locationDetail?: string;
  level?: string;
  latitude: number;
  longitude: number;
  layoutX?: number;
  layoutY?: number;
}

export interface NewDeparture {
  line: string;
  direction: string;
  dayType: DayType;
  /** HH:MM, 24-hour, WIB. */
  departureTime: string;
}

export const adminService = {
  async getReports(filter: { stationId?: string; status?: ReportStatus } = {}): Promise<ModerationReport[]> {
    const { reports } = await apiRequest<{ reports: ModerationReport[] }>(withQuery('/api/admin/reports', filter));
    return reports;
  },

  async getReviews(filter: { stationId?: string } = {}): Promise<ModerationReview[]> {
    const { reviews } = await apiRequest<{ reviews: ModerationReview[] }>(withQuery('/api/admin/reviews', filter));
    return reviews;
  },

  /** Soft delete: the report stops counting for the facility status right away. */
  async removeReport(reportId: string): Promise<RemovalResult> {
    const { removal } = await apiRequest<{ removal: RemovalResult }>(`/api/admin/reports/${id(reportId)}`, { method: 'DELETE' });
    return removal;
  },

  /** Soft delete: hidden from the public and from the chatbot's review search. */
  async removeReview(reviewId: string): Promise<RemovalResult> {
    const { removal } = await apiRequest<{ removal: RemovalResult }>(`/api/admin/reviews/${id(reviewId)}`, { method: 'DELETE' });
    return removal;
  },

  async createStation(input: NewStation): Promise<Station> {
    const { station } = await apiRequest<{ station: Station }>('/api/admin/stations', { method: 'POST', body: input });
    return station;
  },

  /** Every facility of a station, inactive ones included (listed last). */
  async getStationFacilities(stationId: string): Promise<FacilityWithStatus[]> {
    const { facilities } = await apiRequest<{ facilities: FacilityWithStatus[] }>(
      `/api/admin/stations/${id(stationId)}/facilities`,
    );
    return facilities;
  },

  async createFacility(input: NewFacility): Promise<Facility> {
    const { facility } = await apiRequest<{ facility: Facility }>('/api/admin/facilities', { method: 'POST', body: input });
    return facility;
  },

  async getSchedules(stationId: string, dayType?: DayType): Promise<Schedule[]> {
    const { schedules } = await apiRequest<{ schedules: Schedule[] }>(
      withQuery(`/api/admin/stations/${id(stationId)}/schedules`, { dayType }),
    );
    return schedules;
  },

  async addDeparture(stationId: string, input: NewDeparture): Promise<Schedule> {
    const { schedule } = await apiRequest<{ schedule: Schedule }>(`/api/admin/stations/${id(stationId)}/schedules`, {
      method: 'POST',
      body: input,
    });
    return schedule;
  },

  async deleteDeparture(scheduleId: string): Promise<void> {
    await apiRequest<{ deleted: true }>(`/api/admin/schedules/${id(scheduleId)}`, { method: 'DELETE' });
  },
};
