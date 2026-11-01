import 'server-only';
import type { ServerSupabaseClient } from '@/lib/supabase/server';
import { fromDatabaseError } from '@/lib/api/errors';
import { assertAdmin, assertSignedIn, toUserRole, type SessionUser } from './roles';

/**
 * Reads the signed-in user from the request cookies (verified with the Auth server)
 * and their role from profiles. Returns null for guests.
 */
export async function getSessionUser(supabase: ServerSupabaseClient): Promise<SessionUser | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name, role')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profileError) throw fromDatabaseError(profileError);

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    displayName: profile?.display_name ?? null,
    role: toUserRole(profile?.role),
  };
}

export async function requireUser(supabase: ServerSupabaseClient): Promise<SessionUser> {
  return assertSignedIn(await getSessionUser(supabase));
}

export async function requireAdmin(supabase: ServerSupabaseClient): Promise<SessionUser> {
  return assertAdmin(await getSessionUser(supabase));
}
