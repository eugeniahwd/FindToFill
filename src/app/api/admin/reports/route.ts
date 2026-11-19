import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/session';
import { listModerationReports } from '@/lib/data/moderation';
import { reportModerationQuerySchema } from '@/lib/api/moderationSchemas';
import { queryParams } from '@/lib/api/validation';
import { handleRouteError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

/** Admin: recent reports (removed included), newest first. Query: stationId?, status?, limit? (max 100). */
export async function GET(request: Request) {
  try {
    const filter = reportModerationQuerySchema.parse(queryParams(request));
    const db = await createSupabaseServerClient();
    await requireAdmin(db);
    return NextResponse.json({ reports: await listModerationReports(db, filter) });
  } catch (err) {
    return handleRouteError(err);
  }
}
