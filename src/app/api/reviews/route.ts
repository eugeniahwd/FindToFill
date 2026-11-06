import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/session';
import { submitReview } from '@/lib/data/reviews';
import { embedText } from '@/lib/gemini/embeddings';
import { reviewInputSchema } from '@/lib/api/reviewSchemas';
import { handleRouteError } from '@/lib/api/errors';
import { readJsonBody } from '@/lib/api/validation';

export const dynamic = 'force-dynamic';

/**
 * Create or edit the signed-in user's review: JSON { facilityId, rating 1-5, comment <= 500 }.
 * Returns 201 { review, created: true, stampAwarded } for a new review, 200 with created: false for an edit.
 */
export async function POST(request: Request) {
  try {
    const db = await createSupabaseServerClient();
    const user = await requireUser(db);
    const input = reviewInputSchema.parse(await readJsonBody(request));

    const result = await submitReview(
      { db, admin: createSupabaseAdminClient(), embed: embedText },
      { userId: user.id, input },
    );
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (err) {
    return handleRouteError(err);
  }
}
