import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getStation, listStationLayouts } from '@/lib/data/stations';
import { ApiError, handleRouteError } from '@/lib/api/errors';
import { idParamsSchema, type IdRouteContext } from '@/lib/api/validation';

export const dynamic = 'force-dynamic';

/** One station with its layout images (one per level). */
export async function GET(_request: Request, { params }: IdRouteContext) {
  try {
    const { id } = idParamsSchema.parse(await params);
    const db = await createSupabaseServerClient();
    const [station, layouts] = await Promise.all([getStation(db, id), listStationLayouts(db, id)]);
    if (!station) throw new ApiError(404, 'NOT_FOUND', 'Station not found.');
    return NextResponse.json({ station, layouts });
  } catch (err) {
    return handleRouteError(err);
  }
}
