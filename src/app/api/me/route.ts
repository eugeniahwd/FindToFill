import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

/** Returns the signed-in user with their role, or { user: null } for guests. */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getSessionUser(supabase);
    return NextResponse.json({ user });
  } catch (err) {
    return handleRouteError(err);
  }
}
