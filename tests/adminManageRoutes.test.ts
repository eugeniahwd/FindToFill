/**
 * @jest-environment node
 */
import { GET as listReports } from '@/app/api/admin/reports/route';
import { DELETE as removeReportRoute } from '@/app/api/admin/reports/[id]/route';
import { GET as listReviews } from '@/app/api/admin/reviews/route';
import { DELETE as removeReviewRoute } from '@/app/api/admin/reviews/[id]/route';
import { POST as createStation } from '@/app/api/admin/stations/route';
import { POST as createFacility } from '@/app/api/admin/facilities/route';
import { GET as listSchedules, POST as createSchedule } from '@/app/api/admin/stations/[id]/schedules/route';
import { DELETE as deleteScheduleRoute } from '@/app/api/admin/schedules/[id]/route';
import { requireAdmin } from '@/lib/auth/session';
import { listModerationReports, listModerationReviews, removeReport, removeReview } from '@/lib/data/moderation';
import { getStation } from '@/lib/data/stations';
import { ApiError } from '@/lib/api/errors';
import { fakeSupabase } from './helpers/fakeSupabase';

// A plain function (not jest.fn) so resetAllMocks keeps it.
jest.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: async () => mockDb.client }));
jest.mock('@/lib/auth/session');
jest.mock('@/lib/data/moderation');
jest.mock('@/lib/data/stations');

const ADMIN = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: null, displayName: null, role: 'admin' as const };
const STATION = '33333333-3333-4333-8333-333333333333';
const ID = '44444444-4444-4444-8444-444444444444';
const station = { id: STATION, name: 'Tebet', lines: [], latitude: -6.2, longitude: 106.8, isPilot: true };
let mockDb = fakeSupabase({});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const get = (path: string) => new Request(`http://localhost${path}`);
const send = (method: string, body?: unknown) =>
  new Request('http://localhost/api', { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
async function json(res: Response) {
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockDb = fakeSupabase({});
  jest.mocked(requireAdmin).mockResolvedValue(ADMIN);
  jest.mocked(getStation).mockResolvedValue(station);
});

describe('admin-only access', () => {
  it.each([
    ['GET /api/admin/reports', () => listReports(get('/api/admin/reports'))],
    ['DELETE /api/admin/reports/:id', () => removeReportRoute(send('DELETE'), ctx(ID))],
    ['GET /api/admin/reviews', () => listReviews(get('/api/admin/reviews'))],
    ['DELETE /api/admin/reviews/:id', () => removeReviewRoute(send('DELETE'), ctx(ID))],
    ['POST /api/admin/stations', () => createStation(send('POST', { name: 'X', latitude: 0, longitude: 0 }))],
    ['POST /api/admin/stations/:id/schedules', () => createSchedule(send('POST', { line: 'L', direction: 'D', dayType: 'weekday', departureTime: '05:00' }), ctx(STATION))],
    ['DELETE /api/admin/schedules/:id', () => deleteScheduleRoute(send('DELETE'), ctx(ID))],
  ])('%s rejects commuters with 403 and writes nothing', async (_name, call) => {
    jest.mocked(requireAdmin).mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Admin access only.'));
    expect((await call()).status).toBe(403);
    expect(mockDb.calls.filter((c) => c.op !== 'select')).toHaveLength(0);
    expect(removeReport).not.toHaveBeenCalled();
  });
});

describe('moderation routes', () => {
  it('passes the station and status filters through', async () => {
    jest.mocked(listModerationReports).mockResolvedValue([]);
    const res = await listReports(get(`/api/admin/reports?stationId=${STATION}&status=broken&limit=20`));
    expect(await json(res)).toEqual({ status: 200, body: { reports: [] } });
    expect(jest.mocked(listModerationReports).mock.calls[0][1]).toEqual({ stationId: STATION, status: 'broken', limit: 20 });
  });

  it.each([
    ['an unknown status', '?status=kosong'],
    ['a station id that is not a UUID', '?stationId=tebet'],
    ['an unknown parameter', '?includeEverything=1'],
    ['a limit over 100', '?limit=500'],
  ])('rejects %s with 400', async (_case, query) => {
    expect((await listReports(get(`/api/admin/reports${query}`))).status).toBe(400);
    expect(listModerationReports).not.toHaveBeenCalled();
  });

  it('reviews do not take a status filter', async () => {
    expect((await listReviews(get('/api/admin/reviews?status=broken'))).status).toBe(400);
    jest.mocked(listModerationReviews).mockResolvedValue([]);
    expect((await listReviews(get(`/api/admin/reviews?stationId=${STATION}`))).status).toBe(200);
  });

  it('Remove records the signed-in admin as remover', async () => {
    const removal = { id: ID, removedAt: '2026-11-06T10:00:00Z', removedBy: ADMIN.id };
    jest.mocked(removeReport).mockResolvedValue(removal);
    jest.mocked(removeReview).mockResolvedValue(removal);

    expect(await json(await removeReportRoute(send('DELETE'), ctx(ID)))).toEqual({ status: 200, body: { removal } });
    expect(jest.mocked(removeReport).mock.calls[0].slice(1)).toEqual([ADMIN.id, ID]);
    expect((await removeReviewRoute(send('DELETE'), ctx(ID))).status).toBe(200);
    expect((await removeReportRoute(send('DELETE'), ctx('r1'))).status).toBe(400);
  });
});

describe('POST /api/admin/stations', () => {
  it('creates a real (non-demo) pilot station by default', async () => {
    mockDb = fakeSupabase({
      'stations.insert': (c) => ({ data: { id: STATION, is_demo_data: false, ...(c.payload as object) } }),
    });
    const { status, body } = await json(await createStation(send('POST', { name: ' Cawang ', latitude: -6.24, longitude: 106.86 })));

    expect(status).toBe(201);
    expect(mockDb.calls[0].payload).toEqual({ name: 'Cawang', lines: [], latitude: -6.24, longitude: 106.86, is_pilot: true });
    expect(body.station).toMatchObject({ name: 'Cawang', isPilot: true, isDemoData: false });
  });

  it('rejects missing coordinates and unknown fields, and maps a duplicate name to 409', async () => {
    expect((await createStation(send('POST', { name: 'Cawang' }))).status).toBe(400);
    expect((await createStation(send('POST', { name: 'Cawang', latitude: 0, longitude: 0, isDemoData: true }))).status).toBe(400);

    mockDb = fakeSupabase({ 'stations.insert': () => ({ error: { code: '23505', message: 'duplicate key value' } }) });
    const { status, body } = await json(await createStation(send('POST', { name: 'Tebet', latitude: 0, longitude: 0 })));
    expect(status).toBe(409);
    expect(body.error.message).toBe('A station with this name already exists.');
  });
});

describe('POST /api/admin/facilities', () => {
  const valid = { stationId: STATION, type: 'water', name: 'Dispenser Baru', latitude: -6.2, longitude: 106.8 };

  it('creates an active L1 facility by default', async () => {
    mockDb = fakeSupabase({
      'facilities.insert': (c) => ({ data: { id: ID, is_demo_data: false, ...(c.payload as object) } }),
    });
    const { status, body } = await json(await createFacility(send('POST', { ...valid, platform: '' })));

    expect(status).toBe(201);
    expect(mockDb.calls[0].payload).toEqual({
      station_id: STATION, type: 'water', name: 'Dispenser Baru', platform: null, location_detail: null, level: 'L1',
      latitude: -6.2, longitude: 106.8, layout_x: null, layout_y: null, is_active: true,
    });
    expect(body.facility).toMatchObject({ id: ID, level: 'L1', isActive: true });
  });

  it('returns 404 for an unknown station and 400 for a bad type or layout position', async () => {
    jest.mocked(getStation).mockResolvedValue(null);
    expect((await createFacility(send('POST', valid))).status).toBe(404);
    expect((await createFacility(send('POST', { ...valid, type: 'toilet' }))).status).toBe(400);
    expect((await createFacility(send('POST', { ...valid, layoutX: 120 }))).status).toBe(400);
    expect(mockDb.calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });
});

describe('schedules (one departure at a time)', () => {
  const departure = { line: 'Bogor Line', direction: 'Bogor', dayType: 'weekday', departureTime: '05:30' };

  it('adds a departure and returns it as HH:MM', async () => {
    mockDb = fakeSupabase({
      'schedules.insert': (c) => ({ data: { id: ID, ...(c.payload as object), departure_time: '05:30:00' } }),
    });
    const { status, body } = await json(await createSchedule(send('POST', departure), ctx(STATION)));
    expect(status).toBe(201);
    expect(mockDb.calls[0].payload).toEqual({ station_id: STATION, line: 'Bogor Line', direction: 'Bogor', day_type: 'weekday', departure_time: '05:30' });
    expect(body.schedule).toEqual({ id: ID, stationId: STATION, line: 'Bogor Line', direction: 'Bogor', dayType: 'weekday', departureTime: '05:30' });
  });

  it.each(['25:00', '5:30', '05:60', '0530'])('rejects the time %s', async (departureTime) => {
    expect((await createSchedule(send('POST', { ...departure, departureTime }), ctx(STATION))).status).toBe(400);
  });

  it('lists a station timetable, optionally for one day type', async () => {
    mockDb = fakeSupabase({
      'schedules.select': () => ({ data: [{ id: ID, station_id: STATION, line: 'Bogor Line', direction: 'Bogor', day_type: 'weekend', departure_time: '06:00:00' }] }),
    });
    const { body } = await json(await listSchedules(get(`/api/admin/stations/${STATION}/schedules?dayType=weekend`), ctx(STATION)));
    expect(mockDb.calls[0].filters).toEqual([['eq', 'station_id', STATION], ['eq', 'day_type', 'weekend']]);
    expect(body.schedules[0]).toMatchObject({ dayType: 'weekend', departureTime: '06:00' });
  });

  it('deletes one departure, and 404s for an unknown id', async () => {
    mockDb = fakeSupabase({ 'schedules.delete': () => ({ data: [{ id: ID }] }) });
    expect(await json(await deleteScheduleRoute(send('DELETE'), ctx(ID)))).toEqual({ status: 200, body: { deleted: true } });
    expect(mockDb.calls[0].filters).toEqual([['eq', 'id', ID]]);

    mockDb = fakeSupabase({ 'schedules.delete': () => ({ data: [] }) });
    expect((await deleteScheduleRoute(send('DELETE'), ctx(ID))).status).toBe(404);
  });
});
