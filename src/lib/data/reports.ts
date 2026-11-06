import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { Report } from '@/lib/types';
import type { ReportFields } from '@/lib/api/reportSchemas';
import type { ImageType } from '@/lib/reports/photo';
import { ApiError, fromDatabaseError } from '@/lib/api/errors';
import { RATE_LIMITS, assertWithinRateLimit, recordRateLimitEvent } from '@/lib/rate-limit';
import { toReport } from './mappers';
import { REPORT_PHOTO_BUCKET, signReportPhotos } from './photos';
import { awardStamp } from './stamps';
import { bestEffort } from './bestEffort';

type Db = SupabaseClient<Database>;

export interface SubmitReportInput {
  userId: string;
  fields: ReportFields;
  photo: { bytes: Uint8Array; type: ImageType };
}

export interface SubmitReportResult {
  report: Report;
  stampAwarded: boolean;
}

/**
 * Saves a live report: checks the facility and rate limit, uploads the photo to
 * report-photos/{user_id}/{uuid}.{ext}, inserts the report, then awards the stamp.
 * `db` acts as the user (RLS: own folder, own report); `admin` is the service role
 * (rate_limit_events, stamps, cleanup).
 */
export async function submitReport(
  { db, admin }: { db: Db; admin: Db },
  { userId, fields, photo }: SubmitReportInput,
): Promise<SubmitReportResult> {
  const { data: facility, error: facilityError } = await db
    .from('facilities')
    .select('id')
    .eq('id', fields.facilityId)
    .eq('is_active', true)
    .maybeSingle();
  if (facilityError) throw fromDatabaseError(facilityError);
  if (!facility) throw new ApiError(404, 'NOT_FOUND', 'Facility not found.');

  await assertWithinRateLimit(admin, userId, RATE_LIMITS.report);

  const photoPath = `${userId}/${randomUUID()}.${photo.type.ext}`;
  const upload = await db.storage
    .from(REPORT_PHOTO_BUCKET)
    .upload(photoPath, photo.bytes, { contentType: photo.type.mime, upsert: false });
  if (upload.error) {
    throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Could not save the photo. Please try again.');
  }

  const { data: row, error: insertError } = await db
    .from('reports')
    .insert({
      facility_id: fields.facilityId,
      user_id: userId,
      status: fields.status,
      photo_path: photoPath,
      note: fields.note ?? null,
    })
    .select('*')
    .single();
  if (insertError) {
    // Do not leave an orphan photo behind.
    await admin.storage.from(REPORT_PHOTO_BUCKET).remove([photoPath]);
    throw fromDatabaseError(insertError);
  }

  // The report is saved at this point; failures below must not make the client resend it.
  const stampAwarded = await bestEffort('Report stamp', () => awardStamp(admin, userId, fields.facilityId), false);
  await bestEffort('Report rate-limit event', () => recordRateLimitEvent(admin, userId, RATE_LIMITS.report), undefined);

  const urls = await signReportPhotos([photoPath]);
  return { report: toReport(row, urls.get(photoPath) ?? null), stampAwarded };
}

/** The user's own recent reports (not removed), newest first, with signed photo URLs. */
export async function listUserReports(db: Db, userId: string, limit = 10): Promise<Report[]> {
  const { data, error } = await db
    .from('reports')
    .select('*')
    .eq('user_id', userId)
    .is('removed_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw fromDatabaseError(error);

  const urls = await signReportPhotos(data.map((r) => r.photo_path));
  return data.map((row) => toReport(row, urls.get(row.photo_path) ?? null));
}
