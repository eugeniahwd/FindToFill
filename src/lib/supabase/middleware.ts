import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { getSupabasePublicEnv } from './env';

/**
 * Refreshes the Supabase auth session cookie on every request so Route Handlers
 * always see a valid session. Does nothing when Supabase is not configured yet.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const env = getSupabasePublicEnv();
  if (!env) return response;

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  try {
    // Validates the JWT and triggers a token refresh when needed. Do not add code between
    // client creation and this call.
    await supabase.auth.getClaims();
  } catch {
    // Database paused or unreachable: let the request through; route handlers report a friendly error.
  }

  return response;
}
