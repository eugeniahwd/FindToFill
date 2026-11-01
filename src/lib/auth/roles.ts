import type { UserRole } from '@/lib/types';
import { ApiError } from '@/lib/api/apiError';

export interface SessionUser {
  id: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
}

const ROLES: readonly UserRole[] = ['commuter', 'admin'];

/** Any value that is not a known role is treated as the least-privileged role. */
export function toUserRole(value: unknown): UserRole {
  return ROLES.includes(value as UserRole) ? (value as UserRole) : 'commuter';
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === 'admin';
}

export function assertSignedIn(user: SessionUser | null): SessionUser {
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Please log in first.');
  return user;
}

export function assertAdmin(user: SessionUser | null): SessionUser {
  const signedIn = assertSignedIn(user);
  if (!isAdmin(signedIn)) throw new ApiError(403, 'FORBIDDEN', 'Admin access only.');
  return signedIn;
}
