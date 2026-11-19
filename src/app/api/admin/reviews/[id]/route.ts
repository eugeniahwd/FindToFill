import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/session';
import { removeReview } from '@/lib/data/moderation';
import { handleRouteError } from '@/lib/api/errors';
import { idParamsSchema, type IdRouteContext } from '@/lib/api/validation';

export const dynamic = 'force-dynamic';

/**
 * Admin: Remove a review. Soft delete (removed_at, removed_by): hidden from the public and from
 * the chatbot's review search right away. The author cannot post a new review for that facility.
 */
export async function DELETE(_request: Request, { params }: IdRouteContext) {
  try {
    const { id } = idParamsSchema.parse(await params);
    const db = await createSupabaseServerClient();
    const admin = await requireAdmin(db);
    return NextResponse.json({ removal: await removeReview(db, admin.id, id) });
  } catch (err) {
    return handleRouteError(err);
  }
}
