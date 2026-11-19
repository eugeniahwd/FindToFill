import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/session';
import { getStation, listAllStationFacilities } from '@/lib/data/stations';
import { ApiError, handleRouteError } from '@/lib/api/errors';
import { idParamsSchema, type IdRouteContext } from '@/lib/api/validation';

export const dynamic = 'force-dynamic';

/**
 * Admin: every facility of a station with its status, inactive ones included (listed last),
 * so a deactivated facility can be switched back on. Returns { facilities }.
 */
export async function GET(_request: Request, { params }: IdRouteContext) {
  try {
    const { id } = idParamsSchema.parse(await params);
    const db = await createSupabaseServerClient();
    await requireAdmin(db);
    if (!(await getStation(db, id))) throw new ApiError(404, 'NOT_FOUND', 'Station not found.');
    return NextResponse.json({ facilities: await listAllStationFacilities(db, id) });
  } catch (err) {
    return handleRouteError(err);
  }
}
