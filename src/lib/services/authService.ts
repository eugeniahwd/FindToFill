import { User } from '../types';
import { MOCK_USERS } from '../mock/data';

const AUTH_STORAGE_KEY = 'findtofill_mock_user';

export const authService = {
  // TODO(backend): Replace with supabase.auth.signInWithPassword({ email, password })
  async login(email: string, _password?: string): Promise<User> {
    void _password;
    await new Promise((r) => setTimeout(r, 400));
    const normalized = email.toLowerCase().trim();
    
    // Check if it matches predefined demo users
    const match = MOCK_USERS.find((u) => u.email.toLowerCase() === normalized);
    const user: User = match || {
      id: `user-${Date.now()}`,
      email: normalized,
      displayName: normalized.split('@')[0],
      role: 'commuter',
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    }
    return user;
  },

  // TODO(backend): Replace with supabase.auth.signUp({ email, password, options: { data: { display_name } } })
  async register(email: string, _password?: string, displayName?: string): Promise<User> {
    void _password;
    await new Promise((r) => setTimeout(r, 400));
    const normalized = email.toLowerCase().trim();
    const user: User = {
      id: `user-${Date.now()}`,
      email: normalized,
      displayName: displayName?.trim() || normalized.split('@')[0],
      role: 'commuter',
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    }
    return user;
  },

  // TODO(backend): Replace with supabase.auth.getUser() and profile fetch
  async getCurrentUser(): Promise<User | null> {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },

  // TODO(backend): Replace with supabase.auth.signOut()
  async logout(): Promise<void> {
    await new Promise((r) => setTimeout(r, 200));
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  },
};
