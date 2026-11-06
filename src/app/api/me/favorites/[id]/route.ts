import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { getStation } from '@/lib/data/stations';
import { addFavorite, removeFavorite } from '@/lib/data/favorites';
import { ApiError, handleRouteError } from '@/lib/api/errors';
import { idParamsSchema, type IdRouteContext } from '@/lib/api/validation';

export const dynamic = 'force-dynamic';

/** Favorite a station (idempotent). Returns { favorite: true }. */
export async function PUT(_request: Request, { params }: IdRouteContext) {
  try {
    const { id } = idParamsSchema.parse(await params);
    const db = await createSupabaseServerClient();
    const user = await requireUser(db);
    if (!(await getStation(db, id))) throw new ApiError(404, 'NOT_FOUND', 'Station not found.');
    await addFavorite(db, user.id, id);
    return NextResponse.json({ favorite: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Remove a station from favorites (idempotent). Returns { favorite: false }. */
export async function DELETE(_request: Request, { params }: IdRouteContext) {
  try {
    const { id } = idParamsSchema.parse(await params);
    const db = await createSupabaseServerClient();
    const user = await requireUser(db);
    await removeFavorite(db, user.id, id);
    return NextResponse.json({ favorite: false });
  } catch (err) {
    return handleRouteError(err);
  }
}
