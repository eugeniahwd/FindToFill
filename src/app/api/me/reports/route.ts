import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { listUserReports } from '@/lib/data/reports';
import { handleRouteError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

/** The signed-in user's 10 most recent reports (Profile page history). */
export async function GET() {
  try {
    const db = await createSupabaseServerClient();
    const user = await requireUser(db);
    return NextResponse.json({ reports: await listUserReports(db, user.id) });
  } catch (err) {
    return handleRouteError(err);
  }
}
