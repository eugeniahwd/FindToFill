/**
 * @jest-environment node
 */
import { PATCH as patchFacility } from '@/app/api/admin/facilities/[id]/route';
import { PATCH as patchStation } from '@/app/api/admin/stations/[id]/route';
import { facilityUpdateSchema, stationUpdateSchema, toFacilityUpdate } from '@/lib/api/adminSchemas';
import { requireAdmin } from '@/lib/auth/session';
import { ApiError } from '@/lib/api/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { TableRow } from '@/lib/supabase/database.types';

jest.mock('@/lib/auth/session');
jest.mock('@/lib/supabase/server');

const ID = '3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const facilityRow: TableRow<'facilities'> = {
  id: ID, station_id: ID, type: 'water', name: 'Renamed', platform: null, location_detail: 'Gate A', level: 'L1',
  latitude: -6.2, longitude: 106.85, layout_x: 40, layout_y: 60, is_active: true, is_demo_data: true,
};

/** Minimal stand-in for db.from(t).update(v).eq(c, id).select('*').maybeSingle(). */
function fakeDb(result: { data: unknown; error: unknown }) {
  const calls: { table?: string; update?: unknown } = {};
  const chain = {
    update: (v: unknown) => ((calls.update = v), chain),
    eq: () => chain,
    select: () => chain,
    maybeSingle: async () => result,
  };
  return { db: { from: (t: string) => ((calls.table = t), chain) }, calls };
}

const ctx = { params: Promise.resolve({ id: ID }) };
const patch = (body: unknown) =>
  new Request('http://localhost/api', { method: 'PATCH', body: typeof body === 'string' ? body : JSON.stringify(body) });

async function json(res: Response) {
  return { status: res.status, body: await res.json() };
}

beforeEach(() => jest.resetAllMocks());

describe('admin payload schemas', () => {
  it('maps camelCase to columns and turns empty text into null', () => {
    const input = facilityUpdateSchema.parse({ name: ' Renamed ', platform: '', locationDetail: 'Gate A' });
    expect(toFacilityUpdate(input)).toEqual({ name: 'Renamed', platform: null, location_detail: 'Gate A' });
  });

  it('rejects unknown keys, empty payloads, and out-of-range values', () => {
    expect(facilityUpdateSchema.safeParse({ isDemoData: false }).success).toBe(false);
    expect(facilityUpdateSchema.safeParse({ stationId: ID }).success).toBe(false);
    expect(facilityUpdateSchema.safeParse({}).success).toBe(false);
    expect(facilityUpdateSchema.safeParse({ layoutX: 101 }).success).toBe(false);
    expect(stationUpdateSchema.safeParse({ isDemoData: false }).success).toBe(false);
    expect(stationUpdateSchema.safeParse({ latitude: 91 }).success).toBe(false);
  });
});

describe('PATCH /api/admin/facilities/[id]', () => {
  it('rejects guests with 401 and commuters with 403 without updating', async () => {
    const { db, calls } = fakeDb({ data: facilityRow, error: null });
    jest.mocked(createSupabaseServerClient).mockResolvedValue(db as never);

    jest.mocked(requireAdmin).mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'Please log in first.'));
    expect((await patchFacility(patch({ name: 'X' }), ctx)).status).toBe(401);

    jest.mocked(requireAdmin).mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'Admin access only.'));
    expect((await patchFacility(patch({ name: 'X' }), ctx)).status).toBe(403);

    expect(calls.update).toBeUndefined();
  });

  it('updates and returns the facility for an admin', async () => {
    const { db, calls } = fakeDb({ data: facilityRow, error: null });
    jest.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    jest.mocked(requireAdmin).mockResolvedValue({ id: ID, email: null, displayName: null, role: 'admin' });

    const { status, body } = await json(await patchFacility(patch({ name: 'Renamed', locationDetail: 'Gate A' }), ctx));
    expect(status).toBe(200);
    expect(calls).toEqual({ table: 'facilities', update: { name: 'Renamed', location_detail: 'Gate A' } });
    expect(body.facility).toMatchObject({ id: ID, name: 'Renamed', locationDetail: 'Gate A', layoutX: 40 });
  });

  it('returns 400 for invalid JSON or fields, 404 when the facility does not exist', async () => {
    const { db } = fakeDb({ data: null, error: null });
    jest.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    jest.mocked(requireAdmin).mockResolvedValue({ id: ID, email: null, displayName: null, role: 'admin' });

    expect((await patchFacility(patch('{not json'), ctx)).status).toBe(400);
    expect((await patchFacility(patch({ isDemoData: false }), ctx)).status).toBe(400);
    expect((await patchFacility(patch({ name: 'X' }), ctx)).status).toBe(404);
  });
});

describe('PATCH /api/admin/stations/[id]', () => {
  it('maps a duplicate station name to 409', async () => {
    const { db } = fakeDb({ data: null, error: { code: '23505', message: 'duplicate key' } });
    jest.mocked(createSupabaseServerClient).mockResolvedValue(db as never);
    jest.mocked(requireAdmin).mockResolvedValue({ id: ID, email: null, displayName: null, role: 'admin' });

    const { status, body } = await json(await patchStation(patch({ name: 'Tebet' }), ctx));
    expect(status).toBe(409);
    expect(JSON.stringify(body)).not.toContain('duplicate key');
  });
});
