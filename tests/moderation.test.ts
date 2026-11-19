/**
 * @jest-environment node
 */
import { listModerationReports, listModerationReviews, removeReport, removeReview } from '@/lib/data/moderation';
import type { TableRow } from '@/lib/supabase/database.types';
import type { ReviewRow } from '@/lib/data/mappers';
import { fakeSupabase, type FakeResult } from './helpers/fakeSupabase';

jest.mock('@/lib/data/photos', () => ({
  signReportPhotos: jest.fn(async (paths: string[]) => new Map(paths.map((p) => [p, `https://signed.example/${p}`]))),
}));

const ADMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER = '11111111-1111-4111-8111-111111111111';
const FACILITY = '22222222-2222-4222-8222-222222222222';
const STATION = '33333333-3333-4333-8333-333333333333';

const report = (over: Partial<TableRow<'reports'>> = {}): TableRow<'reports'> => ({
  id: 'r1', facility_id: FACILITY, user_id: USER, status: 'broken', photo_path: `${USER}/p.jpg`, note: 'Kran patah',
  created_at: '2026-11-06T08:00:00Z', removed_at: null, removed_by: null, ...over,
});
const review = (over: Partial<ReviewRow> = {}): ReviewRow => ({
  id: 'v1', facility_id: FACILITY, user_id: USER, rating: 1, comment: 'Spam', created_at: '2026-11-06T08:00:00Z',
  updated_at: '2026-11-06T08:00:00Z', removed_at: null, removed_by: null, ...over,
});
const lookups: Record<string, () => FakeResult> = {
  'facilities.select': () => ({ data: [{ id: FACILITY, name: 'Water Dispenser Gate A', station_id: STATION }] }),
  'stations.select': () => ({ data: [{ id: STATION, name: 'Tebet' }] }),
  'profiles.select': () => ({ data: [{ id: USER, display_name: 'budi' }] }),
};

describe('listModerationReports', () => {
  it('lists reports (removed included) with facility, station, reporter, and a signed thumbnail', async () => {
    const db = fakeSupabase({ ...lookups, 'reports.select': () => ({ data: [report(), report({ id: 'r2', removed_at: '2026-11-06T09:00:00Z', removed_by: ADMIN })] }) });
    const reports = await listModerationReports(db.client);

    expect(db.find('reports.select')[0].filters).toEqual([]);
    expect(reports).toHaveLength(2);
    expect(reports[0]).toMatchObject({
      id: 'r1', facilityName: 'Water Dispenser Gate A', stationId: STATION, stationName: 'Tebet', userName: 'budi',
      photoUrl: `https://signed.example/${USER}/p.jpg`, removedAt: null,
    });
    expect(reports[1]).toMatchObject({ id: 'r2', removedBy: ADMIN });
  });

  it('filters by station (through its facilities) and status', async () => {
    const db = fakeSupabase({ ...lookups, 'reports.select': () => ({ data: [] }) });
    await listModerationReports(db.client, { stationId: STATION, status: 'broken' });

    expect(db.find('facilities.select')[0].filters).toEqual([['eq', 'station_id', STATION]]);
    expect(db.find('reports.select')[0].filters).toEqual([
      ['in', 'facility_id', [FACILITY]],
      ['eq', 'status', 'broken'],
    ]);
  });

  it('returns [] for a station without facilities without querying reports', async () => {
    const db = fakeSupabase({ 'facilities.select': () => ({ data: [] }) });
    expect(await listModerationReports(db.client, { stationId: STATION })).toEqual([]);
    expect(db.find('reports.select')).toHaveLength(0);
  });
});

describe('listModerationReviews', () => {
  it('lists reviews with names and without the embedding', async () => {
    const db = fakeSupabase({ ...lookups, 'reviews.select': () => ({ data: [review()] }) });
    const [item] = await listModerationReviews(db.client);
    expect(item).toMatchObject({ id: 'v1', facilityName: 'Water Dispenser Gate A', stationName: 'Tebet', userName: 'budi' });
    expect(item).not.toHaveProperty('embedding');
  });
});

describe('Remove (soft delete)', () => {
  it('sets removed_at and removed_by once, on a row that is not removed yet', async () => {
    const db = fakeSupabase({
      'reports.update': (c) => ({ data: { id: 'r1', ...(c.payload as object) } }),
    });
    const removal = await removeReport(db.client, ADMIN, 'r1');

    const [update] = db.find('reports.update');
    expect(update.payload).toEqual({ removed_at: expect.any(String), removed_by: ADMIN });
    expect(update.filters).toEqual([['eq', 'id', 'r1'], ['is', 'removed_at', null]]);
    expect(removal).toEqual({ id: 'r1', removedAt: expect.any(String), removedBy: ADMIN });
  });

  it('is safe to repeat: an already removed item returns its original removal', async () => {
    const original = { id: 'v1', removed_at: '2026-11-05T10:00:00Z', removed_by: 'other-admin' };
    const db = fakeSupabase({ 'reviews.update': () => ({ data: null }), 'reviews.select': () => ({ data: original }) });
    expect(await removeReview(db.client, ADMIN, 'v1')).toEqual({ id: 'v1', removedAt: original.removed_at, removedBy: 'other-admin' });
  });

  it('returns 404 for an id that does not exist', async () => {
    const db = fakeSupabase({ 'reports.update': () => ({ data: null }), 'reports.select': () => ({ data: null }) });
    await expect(removeReport(db.client, ADMIN, 'nope')).rejects.toMatchObject({ status: 404 });
  });

  it('returns 403 when RLS silently refuses the update (not an admin in the database)', async () => {
    const db = fakeSupabase({
      'reports.update': () => ({ data: null }),
      'reports.select': () => ({ data: { id: 'r1', removed_at: null, removed_by: null } }),
    });
    await expect(removeReport(db.client, ADMIN, 'r1')).rejects.toMatchObject({ status: 403 });
  });
});
