import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/session';
import { getStation } from '@/lib/data/stations';
import { addSchedule, listStationSchedules } from '@/lib/data/schedules';
import { scheduleCreateSchema, scheduleListQuerySchema } from '@/lib/api/adminSchemas';
import { ApiError, handleRouteError } from '@/lib/api/errors';
import { idParamsSchema, queryParams, readJsonBody, type IdRouteContext } from '@/lib/api/validation';

export const dynamic = 'force-dynamic';

/** Admin: a station's departures. Query: dayType? (weekday | weekend). */
export async function GET(request: Request, { params }: IdRouteContext) {
  try {
    const { id } = idParamsSchema.parse(await params);
    const { dayType } = scheduleListQuerySchema.parse(queryParams(request));
    const db = await createSupabaseServerClient();
    await requireAdmin(db);
    if (!(await getStation(db, id))) throw new ApiError(404, 'NOT_FOUND', 'Station not found.');
    return NextResponse.json({ schedules: await listStationSchedules(db, id, dayType) });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Admin adds one departure: { line, direction, dayType, departureTime: "HH:MM" }. Returns 201 { schedule }. */
export async function POST(request: Request, { params }: IdRouteContext) {
  try {
    const { id } = idParamsSchema.parse(await params);
    const db = await createSupabaseServerClient();
    await requireAdmin(db);
    const input = scheduleCreateSchema.parse(await readJsonBody(request));
    if (!(await getStation(db, id))) throw new ApiError(404, 'NOT_FOUND', 'Station not found.');
    return NextResponse.json({ schedule: await addSchedule(db, id, input) }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
