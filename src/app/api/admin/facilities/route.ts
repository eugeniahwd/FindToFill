import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/session';
import { getStation } from '@/lib/data/stations';
import { toFacility } from '@/lib/data/mappers';
import { facilityCreateSchema, toFacilityInsert } from '@/lib/api/adminSchemas';
import { ApiError, fromDatabaseError, handleRouteError } from '@/lib/api/errors';
import { readJsonBody } from '@/lib/api/validation';

export const dynamic = 'force-dynamic';

/**
 * Admin adds a facility to a station: { stationId, type, name, latitude, longitude, platform?,
 * locationDetail?, level? (default L1), layoutX?, layoutY? (0-100), isActive? }. Returns 201 { facility }.
 */
export async function POST(request: Request) {
  try {
    const db = await createSupabaseServerClient();
    await requireAdmin(db);
    const input = facilityCreateSchema.parse(await readJsonBody(request));
    if (!(await getStation(db, input.stationId))) throw new ApiError(404, 'NOT_FOUND', 'Station not found.');

    const { data, error } = await db.from('facilities').insert(toFacilityInsert(input)).select('*').single();
    if (error) throw fromDatabaseError(error);
    return NextResponse.json({ facility: toFacility(data) }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
