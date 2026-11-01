import type { User as AuthUser } from '@supabase/supabase-js';
import { User } from '../types';
import { getSupabaseBrowserClient } from '../supabase/client';
import { isSupabaseConfigured } from '../supabase/env';
import { toUserRole } from '../auth/roles';

async function loadUser(authUser: AuthUser): Promise<User> {
  const supabase = getSupabaseBrowserClient();
  const email = authUser.email ?? '';
  // RLS: a user can read only their own profile row.
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, role')
    .eq('id', authUser.id)
    .maybeSingle();

  return {
    id: authUser.id,
    email,
    displayName: profile?.display_name || email.split('@')[0],
    role: toUserRole(profile?.role),
  };
}

function requirePassword(password?: string): string {
  if (!password) throw new Error('Password is required.');
  return password;
}

export const authService = {
  async login(email: string, password?: string): Promise<User> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password: requirePassword(password),
    });
    if (error || !data.user) throw new Error(error?.message ?? 'Login failed.');
    return loadUser(data.user);
  },

  async register(email: string, password?: string, displayName?: string): Promise<User> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password: requirePassword(password),
      // Read by the handle_new_user trigger to fill profiles.display_name.
      options: { data: { display_name: displayName?.trim() || undefined } },
    });
    if (error || !data.user) throw new Error(error?.message ?? 'Registration failed.');
    if (!data.session) {
      // "Confirm email" is enabled in Supabase Auth settings.
      throw new Error('Check your email to confirm your account, then log in.');
    }
    return loadUser(data.user);
  },

  async getCurrentUser(): Promise<User | null> {
    if (typeof window === 'undefined' || !isSupabaseConfigured()) return null;
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return loadUser(data.user);
  },

  async logout(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    await getSupabaseBrowserClient().auth.signOut();
  },
};
