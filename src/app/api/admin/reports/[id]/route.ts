import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/session';
import { removeReport } from '@/lib/data/moderation';
import { handleRouteError } from '@/lib/api/errors';
import { idParamsSchema, type IdRouteContext } from '@/lib/api/validation';

export const dynamic = 'force-dynamic';

/**
 * Admin: Remove a report. This is a soft delete (removed_at, removed_by): the row is kept,
 * and the report stops counting for the facility status right away. Safe to repeat.
 */
export async function DELETE(_request: Request, { params }: IdRouteContext) {
  try {
    const { id } = idParamsSchema.parse(await params);
    const db = await createSupabaseServerClient();
    const admin = await requireAdmin(db);
    return NextResponse.json({ removal: await removeReport(db, admin.id, id) });
  } catch (err) {
    return handleRouteError(err);
  }
}
