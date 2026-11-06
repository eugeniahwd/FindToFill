/**
 * @jest-environment node
 */
import { addFavorite, listFavoriteStationIds, removeFavorite } from '@/lib/data/favorites';
import { listUserStamps } from '@/lib/data/stamps';
import { PUT as putFavorite, DELETE as deleteFavorite } from '@/app/api/me/favorites/[id]/route';
import { GET as getStamps } from '@/app/api/me/stamps/route';
import { requireUser } from '@/lib/auth/session';
import { getStation } from '@/lib/data/stations';
import { ApiError } from '@/lib/api/errors';
import { fakeSupabase } from './helpers/fakeSupabase';

// A plain function (not jest.fn) so resetAllMocks keeps it.
jest.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: async () => mockDb.client }));
jest.mock('@/lib/auth/session');
jest.mock('@/lib/data/stations');

const USER = { id: '11111111-1111-4111-8111-111111111111', email: null, displayName: null, role: 'commuter' as const };
const STATION = '33333333-3333-4333-8333-333333333333';
let mockDb = fakeSupabase({});

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(requireUser).mockResolvedValue(USER);
});

describe('favorites data', () => {
  it('lists only the user’s favorite station ids', async () => {
    const db = fakeSupabase({ 'favorites.select': () => ({ data: [{ station_id: STATION }] }) });
    expect(await listFavoriteStationIds(db.client, USER.id)).toEqual([STATION]);
    expect(db.calls[0].filters).toEqual([['eq', 'user_id', USER.id]]);
  });

  it('treats favoriting twice as success', async () => {
    const db = fakeSupabase({ 'favorites.insert': () => ({ error: { code: '23505', message: 'duplicate' } }) });
    await expect(addFavorite(db.client, USER.id, STATION)).resolves.toBeUndefined();
    expect(db.calls[0].payload).toEqual({ user_id: USER.id, station_id: STATION });
  });

  it('deletes only the user’s own row for that station', async () => {
    const db = fakeSupabase({ 'favorites.delete': () => ({}) });
    await removeFavorite(db.client, USER.id, STATION);
    expect(db.calls[0].filters).toEqual([
      ['eq', 'user_id', USER.id],
      ['eq', 'station_id', STATION],
    ]);
  });
});

describe('favorites routes', () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it('PUT favorites a station that exists', async () => {
    mockDb = fakeSupabase({ 'favorites.insert': () => ({}) });
    jest.mocked(getStation).mockResolvedValue({ id: STATION, name: 'Tebet', lines: [], latitude: 0, longitude: 0, isPilot: true });
    const res = await putFavorite(new Request('http://localhost', { method: 'PUT' }), ctx(STATION));
    expect(await res.json()).toEqual({ favorite: true });
  });

  it('PUT returns 404 for an unknown station without writing', async () => {
    mockDb = fakeSupabase({});
    jest.mocked(getStation).mockResolvedValue(null);
    const res = await putFavorite(new Request('http://localhost', { method: 'PUT' }), ctx(STATION));
    expect(res.status).toBe(404);
    expect(mockDb.calls).toHaveLength(0);
  });

  it('DELETE requires login', async () => {
    jest.mocked(requireUser).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Please log in first.'));
    expect((await deleteFavorite(new Request('http://localhost'), ctx(STATION))).status).toBe(401);
  });
});

describe('stamps', () => {
  it('adds each facility’s station for the Stamp Map', async () => {
    const db = fakeSupabase({
      'stamps.select': () => ({ data: [{ facility_id: 'f1', stamped_at: '2026-11-05T08:00:00Z' }] }),
      'facilities.select': () => ({ data: [{ id: 'f1', station_id: STATION }] }),
    });
    expect(await listUserStamps(db.client, USER.id)).toEqual([
      { userId: USER.id, facilityId: 'f1', stationId: STATION, stampedAt: '2026-11-05T08:00:00Z' },
    ]);
    expect(db.find('stamps.select')[0].filters).toEqual([['eq', 'user_id', USER.id]]);
  });

  it('GET /api/me/stamps returns [] for a user without stamps', async () => {
    mockDb = fakeSupabase({ 'stamps.select': () => ({ data: [] }) });
    const res = await getStamps();
    expect(await res.json()).toEqual({ stamps: [] });
    expect(mockDb.find('facilities.select')).toHaveLength(0);
  });
});
