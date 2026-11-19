import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { ModerationReport, ModerationReview, RemovalResult, ReportStatus } from '@/lib/types';
import { APP_CONFIG } from '@/lib/config';
import { ApiError, fromDatabaseError } from '@/lib/api/errors';
import { REVIEW_COLUMNS, toReport, toReview } from './mappers';
import { signReportPhotos } from './photos';

// Admin moderation (SPEC 4.7): recent reports and reviews, removed ones included, and Remove
// (soft delete that records who and when). Every call uses the admin's own request client, so
// RLS (is_admin()) enforces access a second time after requireAdmin in the route.

type Db = SupabaseClient<Database>;

export interface ModerationFilter {
  stationId?: string;
  status?: ReportStatus;
  limit?: number;
}

interface FacilityInfo {
  facilityName: string;
  stationId: string;
  stationName: string;
}

/** Facility ids of a station (inactive ones included: admins see them through RLS). */
async function stationFacilityIds(db: Db, stationId: string): Promise<string[]> {
  const { data, error } = await db.from('facilities').select('id').eq('station_id', stationId);
  if (error) throw fromDatabaseError(error);
  return data.map((f) => f.id);
}

/** facility id -> facility, station id, and station name. */
async function facilityInfo(db: Db, facilityIds: string[]): Promise<Map<string, FacilityInfo>> {
  const ids = [...new Set(facilityIds)];
  if (ids.length === 0) return new Map();
  const { data: facilities, error } = await db.from('facilities').select('id, name, station_id').in('id', ids);
  if (error) throw fromDatabaseError(error);

  const stationIds = [...new Set(facilities.map((f) => f.station_id))];
  const { data: stations, error: stationError } = await db.from('stations').select('id, name').in('id', stationIds);
  if (stationError) throw fromDatabaseError(stationError);

  const stationNames = new Map(stations.map((s) => [s.id, s.name]));
  return new Map(
    facilities.map((f) => [
      f.id,
      { facilityName: f.name, stationId: f.station_id, stationName: stationNames.get(f.station_id) ?? '' },
    ]),
  );
}

/** user id -> display name. Admins may read all profiles (RLS "profiles: admin reads all"). */
async function displayNames(db: Db, userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const { data, error } = await db.from('profiles').select('id, display_name').in('id', ids);
  if (error) throw fromDatabaseError(error);
  return new Map(data.flatMap((p) => (p.display_name ? [[p.id, p.display_name] as const] : [])));
}

const limitOf = (filter: ModerationFilter) =>
  Math.min(filter.limit ?? APP_CONFIG.MODERATION_LIST_LIMIT, APP_CONFIG.MODERATION_LIST_MAX);

/** Recent reports for moderation, newest first, with signed photo thumbnails. */
export async function listModerationReports(db: Db, filter: ModerationFilter = {}): Promise<ModerationReport[]> {
  const scope = filter.stationId ? await stationFacilityIds(db, filter.stationId) : null;
  if (scope?.length === 0) return [];

  let query = db.from('reports').select('*');
  if (scope) query = query.in('facility_id', scope);
  if (filter.status) query = query.eq('status', filter.status);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limitOf(filter));
  if (error) throw fromDatabaseError(error);

  const [info, names, photos] = await Promise.all([
    facilityInfo(db, data.map((r) => r.facility_id)),
    displayNames(db, data.map((r) => r.user_id)),
    signReportPhotos(data.map((r) => r.photo_path)),
  ]);
  return data.map((row) => ({
    ...toReport(row, photos.get(row.photo_path) ?? null),
    userName: names.get(row.user_id),
    ...(info.get(row.facility_id) ?? { facilityName: '', stationId: '', stationName: '' }),
  }));
}

/** Recent reviews for moderation, newest first (never the embedding). */
export async function listModerationReviews(db: Db, filter: ModerationFilter = {}): Promise<ModerationReview[]> {
  const scope = filter.stationId ? await stationFacilityIds(db, filter.stationId) : null;
  if (scope?.length === 0) return [];

  let query = db.from('reviews').select(REVIEW_COLUMNS);
  if (scope) query = query.in('facility_id', scope);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limitOf(filter));
  if (error) throw fromDatabaseError(error);

  const [info, names] = await Promise.all([
    facilityInfo(db, data.map((r) => r.facility_id)),
    displayNames(db, data.map((r) => r.user_id)),
  ]);
  return data.map((row) => {
    const facility = info.get(row.facility_id) ?? { facilityName: '', stationId: '', stationName: '' };
    return { ...toReview(row, facility.facilityName), ...facility, userName: names.get(row.user_id) };
  });
}

/**
 * Soft-deletes a report or review: sets removed_at and removed_by once. Removing an item that
 * is already removed returns the original removal (safe to repeat); a missing id is 404.
 * Removed reports drop out of facility_status at once; removed reviews out of match_reviews.
 */
async function softDelete(db: Db, table: 'reports' | 'reviews', adminId: string, id: string): Promise<RemovalResult> {
  const { data, error } = await db
    .from(table)
    .update({ removed_at: new Date().toISOString(), removed_by: adminId })
    .eq('id', id)
    .is('removed_at', null)
    .select('id, removed_at, removed_by')
    .maybeSingle();
  if (error) throw fromDatabaseError(error);

  let row = data;
  if (!row) {
    const { data: existing, error: readError } = await db
      .from(table)
      .select('id, removed_at, removed_by')
      .eq('id', id)
      .maybeSingle();
    if (readError) throw fromDatabaseError(readError);
    row = existing;
  }
  if (!row) throw new ApiError(404, 'NOT_FOUND', table === 'reports' ? 'Report not found.' : 'Review not found.');
  // The row exists but RLS silently refused the update (not an admin in the database).
  if (!row.removed_at || !row.removed_by) throw new ApiError(403, 'FORBIDDEN', 'You are not allowed to do this.');
  return { id: row.id, removedAt: row.removed_at, removedBy: row.removed_by };
}

export const removeReport = (db: Db, adminId: string, reportId: string) => softDelete(db, 'reports', adminId, reportId);
export const removeReview = (db: Db, adminId: string, reviewId: string) => softDelete(db, 'reviews', adminId, reviewId);
