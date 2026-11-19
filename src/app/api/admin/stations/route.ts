import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/session';
import { toStation } from '@/lib/data/mappers';
import { stationCreateSchema, toStationInsert } from '@/lib/api/adminSchemas';
import { ApiError, fromDatabaseError, handleRouteError } from '@/lib/api/errors';
import { readJsonBody } from '@/lib/api/validation';

export const dynamic = 'force-dynamic';

/** Admin adds a station: { name, lines?, latitude, longitude, isPilot? }. Returns 201 { station }. */
export async function POST(request: Request) {
  try {
    const db = await createSupabaseServerClient();
    await requireAdmin(db);
    const input = stationCreateSchema.parse(await readJsonBody(request));

    const { data, error } = await db.from('stations').insert(toStationInsert(input)).select('*').single();
    if (error) {
      if (error.code === '23505') throw new ApiError(409, 'CONFLICT', 'A station with this name already exists.');
      throw fromDatabaseError(error);
    }
    return NextResponse.json({ station: toStation(data) }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
