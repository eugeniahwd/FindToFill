import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listStations } from '@/lib/data/stations';
import { handleRouteError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

/** All stations with center coordinates. The browser detects the nearest one; GPS never reaches the server. */
export async function GET() {
  try {
    const db = await createSupabaseServerClient();
    return NextResponse.json({ stations: await listStations(db) });
  } catch (err) {
    return handleRouteError(err);
  }
}
