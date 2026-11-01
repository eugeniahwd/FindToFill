import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { requireSupabasePublicEnv } from './env';

export type BrowserSupabaseClient = SupabaseClient<Database>;

let browserClient: BrowserSupabaseClient | null = null;

/**
 * Supabase client for Client Components. Uses the anon key only, so every query runs under RLS.
 * The session is stored in cookies so Route Handlers can read it.
 */
export function getSupabaseBrowserClient(): BrowserSupabaseClient {
  if (browserClient) return browserClient;
  const { url, anonKey } = requireSupabasePublicEnv();
  browserClient = createBrowserClient<Database>(url, anonKey);
  return browserClient;
}
