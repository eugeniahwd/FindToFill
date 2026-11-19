import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/session';
import { deleteSchedule } from '@/lib/data/schedules';
import { handleRouteError } from '@/lib/api/errors';
import { idParamsSchema, type IdRouteContext } from '@/lib/api/validation';

export const dynamic = 'force-dynamic';

/** Admin deletes one departure (timetable data, not user content, so this is a real delete). */
export async function DELETE(_request: Request, { params }: IdRouteContext) {
  try {
    const { id } = idParamsSchema.parse(await params);
    const db = await createSupabaseServerClient();
    await requireAdmin(db);
    await deleteSchedule(db, id);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
