import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { requireSupabasePublicEnv } from './env';

export type ServerSupabaseClient = SupabaseClient<Database>;

/**
 * Supabase client for Route Handlers and Server Components, acting as the signed-in user
 * (or anon for guests). RLS applies. Create one per request.
 */
export async function createSupabaseServerClient(): Promise<ServerSupabaseClient> {
  const { url, anonKey } = requireSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. The middleware refreshes the session.
        }
      },
    },
  });
}
