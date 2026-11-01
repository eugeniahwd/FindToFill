import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/session';
import { toFacility } from '@/lib/data/mappers';
import { facilityUpdateSchema, toFacilityUpdate } from '@/lib/api/adminSchemas';
import { ApiError, fromDatabaseError, handleRouteError } from '@/lib/api/errors';
import { idParamsSchema, readJsonBody, type IdRouteContext } from '@/lib/api/validation';

export const dynamic = 'force-dynamic';

/** Admin edits a facility. Enforced here (requireAdmin) and again by RLS (is_admin()). */
export async function PATCH(request: Request, { params }: IdRouteContext) {
  try {
    const { id } = idParamsSchema.parse(await params);
    const db = await createSupabaseServerClient();
    await requireAdmin(db);
    const updates = toFacilityUpdate(facilityUpdateSchema.parse(await readJsonBody(request)));

    const { data, error } = await db.from('facilities').update(updates).eq('id', id).select('*').maybeSingle();
    if (error) throw fromDatabaseError(error);
    if (!data) throw new ApiError(404, 'NOT_FOUND', 'Facility not found.');
    return NextResponse.json({ facility: toFacility(data) });
  } catch (err) {
    return handleRouteError(err);
  }
}
