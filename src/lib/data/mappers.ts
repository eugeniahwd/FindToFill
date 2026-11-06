import type { TableRow, ViewRow } from '@/lib/supabase/database.types';
import type { Facility, FacilityWithStatus, Report, Review, Station, StationLayout } from '@/lib/types';

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

/** photoUrl is a short-lived signed URL (private bucket), or '' when it could not be signed. */
export function toReport(row: TableRow<'reports'>, photoUrl: string | null): Report {
  return {
    id: row.id,
    facilityId: row.facility_id,
    userId: row.user_id,
    status: row.status,
    photoUrl: photoUrl ?? '',
    note: row.note ?? undefined,
    createdAt: row.created_at,
    removedAt: row.removed_at,
    removedBy: row.removed_by,
  };
}

/** Review columns sent to the browser: never the embedding vector. */
export const REVIEW_COLUMNS = 'id, facility_id, user_id, rating, comment, created_at, updated_at, removed_at, removed_by';
export type ReviewRow = Omit<TableRow<'reviews'>, 'embedding'>;

/** No author name: profiles are private (RLS), and display names come from email prefixes. */
export function toReview(row: ReviewRow, facilityName?: string): Review {
  return {
    id: row.id,
    facilityId: row.facility_id,
    facilityName,
    userId: row.user_id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    removedAt: row.removed_at,
    removedBy: row.removed_by,
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
