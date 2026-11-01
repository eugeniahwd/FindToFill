import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fromDatabaseError, handleRouteError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

/** Checks that the database is reachable. Also handy to wake a paused free-tier project before a demo. */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { count, error } = await supabase.from('stations').select('id', { count: 'exact', head: true });
    if (error) throw fromDatabaseError(error);
    return NextResponse.json({ ok: true, stations: count ?? 0 });
  } catch (err) {
    return handleRouteError(err);
  }
}
