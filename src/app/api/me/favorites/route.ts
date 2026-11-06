import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { listFavoriteStationIds } from '@/lib/data/favorites';
import { handleRouteError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

/** The signed-in user's favorite station ids, newest first. */
export async function GET() {
  try {
    const db = await createSupabaseServerClient();
    const user = await requireUser(db);
    return NextResponse.json({ stationIds: await listFavoriteStationIds(db, user.id) });
  } catch (err) {
    return handleRouteError(err);
  }
}
