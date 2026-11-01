import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getFacility } from '@/lib/data/stations';
import { ApiError, handleRouteError } from '@/lib/api/errors';
import { idParamsSchema, type IdRouteContext } from '@/lib/api/validation';

export const dynamic = 'force-dynamic';

/** One active facility with its current status (used by the report and detail pages). */
export async function GET(_request: Request, { params }: IdRouteContext) {
  try {
    const { id } = idParamsSchema.parse(await params);
    const db = await createSupabaseServerClient();
    const facility = await getFacility(db, id);
    if (!facility) throw new ApiError(404, 'NOT_FOUND', 'Facility not found.');
    return NextResponse.json({ facility });
  } catch (err) {
    return handleRouteError(err);
  }
}
