import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { Review } from '@/lib/types';
import type { ReviewInput } from '@/lib/api/reviewSchemas';
import { APP_CONFIG } from '@/lib/config';
import { ApiError, fromDatabaseError } from '@/lib/api/errors';
import { reviewSnippet } from '@/lib/api/sanitize';
import { RATE_LIMITS, assertWithinRateLimit, recordRateLimitEvent } from '@/lib/rate-limit';
import type { EmbeddingPurpose } from '@/lib/gemini/embeddings';
import { toPgVector } from '@/lib/gemini/embeddings';
import { REVIEW_COLUMNS, toReview } from './mappers';
import { awardStamp } from './stamps';
import { bestEffort } from './bestEffort';

type Db = SupabaseClient<Database>;
type Embed = (text: string, purpose: EmbeddingPurpose) => Promise<number[] | null>;

export interface SubmitReviewResult {
  review: Review;
  /** false when the user edited their existing review for this facility. */
  created: boolean;
  stampAwarded: boolean;
}

const ALREADY_REVIEWED = 'You cannot review this facility again.';

/** Non-removed reviews of a station's facilities, newest first. */
export async function listStationReviews(
  db: Db,
  stationId: string,
  limit: number = APP_CONFIG.STATION_REVIEWS_LIMIT,
): Promise<Review[]> {
  const { data: facilities, error: facilityError } = await db
    .from('facilities')
    .select('id, name')
    .eq('station_id', stationId);
  if (facilityError) throw fromDatabaseError(facilityError);
  if (facilities.length === 0) return [];

  const names = new Map(facilities.map((f) => [f.id, f.name]));
  const { data, error } = await db
    .from('reviews')
    .select(REVIEW_COLUMNS)
    .in('facility_id', [...names.keys()])
    .is('removed_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw fromDatabaseError(error);
  return data.map((row) => toReview(row, names.get(row.facility_id)));
}

/** Non-removed reviews of the given facilities, newest first. */
async function listFacilityReviews(db: Db, facilities: ReviewSearchFacilities, limit: number): Promise<Review[]> {
  const names = new Map(facilities.map((f) => [f.id, f.name]));
  const { data, error } = await db
    .from('reviews')
    .select(REVIEW_COLUMNS)
    .in('facility_id', [...names.keys()])
    .is('removed_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw fromDatabaseError(error);
  return data.map((row) => toReview(row, names.get(row.facility_id)));
}

export interface ReviewSnippet {
  reviewId: string;
  facilityId: string;
  facilityName: string;
  rating: number;
  /** URLs removed, max 300 characters. Untrusted user text: data for the model, never instructions. */
  comment: string;
  createdAt: string;
}

export interface ReviewSearchResult {
  /** 'semantic' = match_reviews by embedding; 'latest' = fallback when there is no query vector. */
  method: 'semantic' | 'latest';
  reviews: ReviewSnippet[];
}

/** Restricts a review search to these facilities (e.g. the station's active water facilities). */
export type ReviewSearchFacilities = { id: string; name: string }[];

/**
 * Reviews for the search_reviews chatbot tool: the closest matches to `queryVector`
 * (match_reviews), or the latest reviews when the vector is missing or the search fails.
 * With `onlyFacilities`, only reviews of those facilities count. match_reviews cannot filter
 * by facility, so it is asked for more rows and the result is filtered and cut to `limit`.
 */
export async function searchStationReviews(
  db: Db,
  stationId: string,
  queryVector: number[] | null,
  limit: number = APP_CONFIG.REVIEW_SEARCH_LIMIT,
  onlyFacilities?: ReviewSearchFacilities,
): Promise<ReviewSearchResult> {
  const snippet = (comment: string) => reviewSnippet(comment, APP_CONFIG.REVIEW_SNIPPET_MAX_CHARS);
  if (onlyFacilities && onlyFacilities.length === 0) return { method: queryVector ? 'semantic' : 'latest', reviews: [] };
  const allowed = onlyFacilities ? new Set(onlyFacilities.map((f) => f.id)) : null;
  const matchCount = allowed ? Math.min(limit * APP_CONFIG.REVIEW_SEARCH_OVERFETCH, 50) : limit;

  if (queryVector) {
    const [{ data: matches, error }, { data: facilities, error: facilityError }] = await Promise.all([
      db.rpc('match_reviews', { query_embedding: toPgVector(queryVector), p_station_id: stationId, match_count: matchCount }),
      onlyFacilities
        ? Promise.resolve({ data: onlyFacilities, error: null })
        : db.from('facilities').select('id, name').eq('station_id', stationId),
    ]);
    if (!error && !facilityError) {
      const names = new Map(facilities.map((f) => [f.id, f.name]));
      const kept = allowed ? matches.filter((m) => allowed.has(m.facility_id)).slice(0, limit) : matches;
      return {
        method: 'semantic',
        reviews: kept.map((m) => ({
          reviewId: m.review_id,
          facilityId: m.facility_id,
          facilityName: names.get(m.facility_id) ?? '',
          rating: m.rating,
          comment: snippet(m.comment),
          createdAt: m.created_at,
        })),
      };
    }
    console.error('Review search failed, using latest reviews:', error?.code ?? facilityError?.code ?? 'unknown');
  }

  const latest = onlyFacilities
    ? await listFacilityReviews(db, onlyFacilities, limit)
    : await listStationReviews(db, stationId, limit);
  return {
    method: 'latest',
    reviews: latest.map((r) => ({
      reviewId: r.id,
      facilityId: r.facilityId,
      facilityName: r.facilityName ?? '',
      rating: r.rating,
      comment: snippet(r.comment),
      createdAt: r.createdAt,
    })),
  };
}

/**
 * Creates the user's review for a facility, or edits it if one exists (one per user per
 * facility). An edit changes only rating, comment, and embedding, so this is an explicit insert
 * or update rather than an upsert. `db` acts as the user (reads the facility under RLS).
 * `admin` is the service role and does every review read and write: clients have no insert or
 * update on reviews, so the rate limit and the server-made embedding cannot be skipped.
 * `userId` must come from the verified session.
 */
export async function submitReview(
  { db, admin, embed }: { db: Db; admin: Db; embed: Embed },
  { userId, input }: { userId: string; input: ReviewInput },
): Promise<SubmitReviewResult> {
  const { data: facility, error: facilityError } = await db
    .from('facilities')
    .select('id, name')
    .eq('id', input.facilityId)
    .eq('is_active', true)
    .maybeSingle();
  if (facilityError) throw fromDatabaseError(facilityError);
  if (!facility) throw new ApiError(404, 'NOT_FOUND', 'Facility not found.');

  await assertWithinRateLimit(admin, userId, RATE_LIMITS.review);

  // The service role also sees removed reviews: a review a moderator removed stays removed.
  const { data: existing, error: existingError } = await admin
    .from('reviews')
    .select('id, removed_at')
    .eq('user_id', userId)
    .eq('facility_id', input.facilityId)
    .maybeSingle();
  if (existingError) throw fromDatabaseError(existingError);
  if (existing?.removed_at) throw new ApiError(409, 'CONFLICT', ALREADY_REVIEWED);

  // An edit without a fresh vector stores null, so search never matches the old text.
  const vector = await embed(input.comment, 'document');
  const fields = { rating: input.rating, comment: input.comment, embedding: vector ? toPgVector(vector) : null };

  const { data: row, error } = existing
    ? await admin.from('reviews').update(fields).eq('id', existing.id).select(REVIEW_COLUMNS).single()
    : await admin
        .from('reviews')
        .insert({ ...fields, facility_id: input.facilityId, user_id: userId })
        .select(REVIEW_COLUMNS)
        .single();
  if (error) {
    if (error.code === '23505' || error.code === 'PGRST116') throw new ApiError(409, 'CONFLICT', ALREADY_REVIEWED);
    throw fromDatabaseError(error);
  }

  // The review is saved at this point; failures below must not make the client resend it.
  const created = !existing;
  const stampAwarded = created
    ? await bestEffort('Review stamp', () => awardStamp(admin, userId, input.facilityId), false)
    : false;
  await bestEffort('Review rate-limit event', () => recordRateLimitEvent(admin, userId, RATE_LIMITS.review), undefined);

  return { review: toReview(row, facility.name), created, stampAwarded };
}
