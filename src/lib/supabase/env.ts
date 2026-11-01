export interface SupabasePublicEnv {
  url: string;
  anonKey: string;
}

export class SupabaseConfigError extends Error {
  constructor(message = 'Supabase is not configured. Fill in .env.local (see .env.example).') {
    super(message);
    this.name = 'SupabaseConfigError';
  }
}

/**
 * Returns the public Supabase settings, or null when they are missing.
 * The NEXT_PUBLIC_ variables are referenced literally so Next.js can inline them in the browser bundle.
 */
export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function requireSupabasePublicEnv(): SupabasePublicEnv {
  const env = getSupabasePublicEnv();
  if (!env) throw new SupabaseConfigError();
  return env;
}

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicEnv() !== null;
}
