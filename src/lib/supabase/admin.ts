import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { requireSupabasePublicEnv, SupabaseConfigError } from './env';

export type AdminSupabaseClient = SupabaseClient<Database>;

/**
 * Service-role client: BYPASSES RLS. Use only in Route Handlers for server-side work
 * (stamps, rate limits, chat logs, signed photo URLs). Never import from client code.
 */
export function createSupabaseAdminClient(): AdminSupabaseClient {
  const { url } = requireSupabasePublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new SupabaseConfigError('SUPABASE_SERVICE_ROLE_KEY is not set.');
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
