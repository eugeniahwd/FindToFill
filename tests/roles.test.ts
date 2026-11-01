import { assertAdmin, assertSignedIn, isAdmin, toUserRole, type SessionUser } from '@/lib/auth/roles';
import { ApiError } from '@/lib/api/apiError';

const commuter: SessionUser = { id: 'u1', email: 'a@b.c', displayName: 'a', role: 'commuter' };
const admin: SessionUser = { ...commuter, id: 'u2', role: 'admin' };

function thrown(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (err) {
    if (err instanceof ApiError) return err;
    throw err;
  }
  throw new Error('expected an ApiError');
}

describe('role protection', () => {
  it('maps unknown or missing roles to commuter (least privilege)', () => {
    expect(toUserRole('admin')).toBe('admin');
    expect(toUserRole('commuter')).toBe('commuter');
    expect(toUserRole('superuser')).toBe('commuter');
    expect(toUserRole(undefined)).toBe('commuter');
    expect(toUserRole(null)).toBe('commuter');
  });

  it('isAdmin is true only for admins', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(commuter)).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it('assertSignedIn rejects guests with 401', () => {
    expect(thrown(() => assertSignedIn(null))).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(assertSignedIn(commuter)).toBe(commuter);
  });

  it('assertAdmin rejects guests with 401 and commuters with 403', () => {
    expect(thrown(() => assertAdmin(null))).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(thrown(() => assertAdmin(commuter))).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(assertAdmin(admin)).toBe(admin);
  });
});
