import type { TableRow, ViewRow } from '@/lib/supabase/database.types';
import type { Facility, FacilityWithStatus, Station, StationLayout } from '@/lib/types';

// Database rows (snake_case, null) -> app types (camelCase, undefined). No I/O here.

export function toStation(row: TableRow<'stations'>): Station {
  return {
    id: row.id,
    name: row.name,
    lines: row.lines,
    latitude: row.latitude,
    longitude: row.longitude,
    isPilot: row.is_pilot,
    isDemoData: row.is_demo_data,
  };
}

export function toStationLayout(row: TableRow<'station_layouts'>): StationLayout {
  return {
    id: row.id,
    stationId: row.station_id,
    level: row.level,
    imageUrl: row.image_url,
    notes: row.notes ?? undefined,
  };
}

export function toFacility(row: TableRow<'facilities'>): Facility {
  return {
    id: row.id,
    stationId: row.station_id,
    type: row.type,
    name: row.name,
    platform: row.platform ?? undefined,
    locationDetail: row.location_detail ?? undefined,
    level: row.level ?? undefined,
    latitude: row.latitude,
    longitude: row.longitude,
    layoutX: row.layout_x === null ? undefined : Number(row.layout_x),
    layoutY: row.layout_y === null ? undefined : Number(row.layout_y),
    isActive: row.is_active,
    isDemoData: row.is_demo_data,
  };
}

/**
 * Combines a facility with its row from the facility_status view (7-day window).
 * No active report means 'unknown' ("No recent report").
 */
export function withStatus(
  facility: Facility,
  status: ViewRow<'facility_status'> | undefined,
  lastPhotoUrl: string | null,
): FacilityWithStatus {
  return {
    ...facility,
    currentStatus: status?.status ?? 'unknown',
    lastReportedAt: status?.status ? status.last_reported_at : null,
    lastPhotoUrl: status?.status ? lastPhotoUrl : null,
    activeReportCount: status?.active_report_count ?? 0,
  };
}
