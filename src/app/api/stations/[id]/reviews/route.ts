import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getStation } from '@/lib/data/stations';
import { listStationReviews } from '@/lib/data/reviews';
import { ApiError, handleRouteError } from '@/lib/api/errors';
import { idParamsSchema, type IdRouteContext } from '@/lib/api/validation';

export const dynamic = 'force-dynamic';

/** Public: non-removed reviews of the station's facilities, newest first (max 50). */
export async function GET(_request: Request, { params }: IdRouteContext) {
  try {
    const { id } = idParamsSchema.parse(await params);
    const db = await createSupabaseServerClient();
    const [station, reviews] = await Promise.all([getStation(db, id), listStationReviews(db, id)]);
    if (!station) throw new ApiError(404, 'NOT_FOUND', 'Station not found.');
    return NextResponse.json({ reviews });
  } catch (err) {
    return handleRouteError(err);
  }
}
