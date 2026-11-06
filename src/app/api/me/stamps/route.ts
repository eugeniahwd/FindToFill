import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { listUserStamps } from '@/lib/data/stamps';
import { handleRouteError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

/** The signed-in user's stamps (one per facility) with each facility's station, for the Stamp Map. */
export async function GET() {
  try {
    const db = await createSupabaseServerClient();
    const user = await requireUser(db);
    return NextResponse.json({ stamps: await listUserStamps(db, user.id) });
  } catch (err) {
    return handleRouteError(err);
  }
}
