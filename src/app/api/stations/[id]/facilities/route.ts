import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getStation, listStationFacilities } from '@/lib/data/stations';
import { ApiError, handleRouteError } from '@/lib/api/errors';
import { idParamsSchema, type IdRouteContext } from '@/lib/api/validation';

export const dynamic = 'force-dynamic';

/**
 * Active facilities of a station with their current status (7-day window).
 * Distances are added in the browser with rankFacilities() so GPS coordinates stay on the device.
 */
export async function GET(_request: Request, { params }: IdRouteContext) {
  try {
    const { id } = idParamsSchema.parse(await params);
    const db = await createSupabaseServerClient();
    const [station, facilities] = await Promise.all([getStation(db, id), listStationFacilities(db, id)]);
    if (!station) throw new ApiError(404, 'NOT_FOUND', 'Station not found.');
    return NextResponse.json({ facilities });
  } catch (err) {
    return handleRouteError(err);
  }
}
