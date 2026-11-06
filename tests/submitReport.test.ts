/**
 * @jest-environment node
 */
import { submitReport } from '@/lib/data/reports';
import type { TableRow } from '@/lib/supabase/database.types';
import { fakeSupabase, type FakeResult } from './helpers/fakeSupabase';

jest.mock('@/lib/data/photos', () => ({
  REPORT_PHOTO_BUCKET: 'report-photos',
  signReportPhotos: jest.fn(async (paths: string[]) => new Map(paths.map((p) => [p, `https://signed.example/${p}`]))),
}));

const USER = '11111111-1111-4111-8111-111111111111';
const FACILITY = '22222222-2222-4222-8222-222222222222';
const photo = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), type: { mime: 'image/jpeg', ext: 'jpg' } as const };
const input = { userId: USER, fields: { facilityId: FACILITY, status: 'empty' as const, note: 'Galon habis' }, photo };

function reportRow(path: string): TableRow<'reports'> {
  return {
    id: 'r1', facility_id: FACILITY, user_id: USER, status: 'empty', photo_path: path, note: 'Galon habis',
    created_at: '2026-11-02T08:00:00Z', removed_at: null, removed_by: null,
  };
}

function setup(over: Partial<Record<string, () => FakeResult>> = {}) {
  const db = fakeSupabase({
    'facilities.select': () => ({ data: { id: FACILITY } }),
    'storage.upload': () => ({ data: { path: 'x' } }),
    'reports.insert': (c) => ({ data: reportRow((c.payload as { photo_path: string }).photo_path) }),
    ...over,
  });
  const admin = fakeSupabase({
    'rate_limit_events.select': () => ({ count: 0 }),
    'rate_limit_events.insert': () => ({}),
    'stamps.upsert': () => ({ data: [{ user_id: USER }] }),
    'storage.remove': () => ({}),
    ...over,
  });
  return { db, admin, deps: { db: db.client, admin: admin.client } };
}

describe('submitReport', () => {
  it('uploads the photo to the user folder, saves the report, and awards the first stamp', async () => {
    const { db, admin, deps } = setup();
    const result = await submitReport(deps, input);

    const [upload] = db.find('storage.upload');
    const { bucket, args } = upload.payload as { bucket: string; args: [string, Uint8Array, { contentType: string }] };
    expect(bucket).toBe('report-photos');
    expect(args[0]).toMatch(new RegExp(`^${USER}/[0-9a-f-]{36}\\.jpg$`));
    expect(args[2]).toMatchObject({ contentType: 'image/jpeg', upsert: false });

    expect(db.find('reports.insert')[0].payload).toEqual({
      facility_id: FACILITY, user_id: USER, status: 'empty', photo_path: args[0], note: 'Galon habis',
    });
    expect(admin.find('stamps.upsert')[0].options).toMatchObject({ ignoreDuplicates: true });
    expect(admin.find('rate_limit_events.insert')[0].payload).toEqual({ key: USER, action: 'report' });

    expect(result.stampAwarded).toBe(true);
    expect(result.report).toMatchObject({ id: 'r1', status: 'empty', photoUrl: `https://signed.example/${args[0]}` });
  });

  it('does not award a second stamp for the same facility', async () => {
    const { deps } = setup({ 'stamps.upsert': () => ({ data: [] }) });
    expect((await submitReport(deps, input)).stampAwarded).toBe(false);
  });

  it('stores an empty note as null', async () => {
    const { db, deps } = setup();
    await submitReport(deps, { ...input, fields: { ...input.fields, note: undefined } });
    expect(db.find('reports.insert')[0].payload).toMatchObject({ note: null });
  });

  it('rejects the 6th report within the hour with 429 before uploading anything', async () => {
    const { db, deps } = setup({ 'rate_limit_events.select': () => ({ count: 5 }) });
    await expect(submitReport(deps, input)).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED' });
    expect(db.find('storage.upload')).toHaveLength(0);
  });

  it('returns 404 for a missing or inactive facility before uploading', async () => {
    const { db, deps } = setup({ 'facilities.select': () => ({ data: null }) });
    await expect(submitReport(deps, input)).rejects.toMatchObject({ status: 404 });
    expect(db.find('storage.upload')).toHaveLength(0);
  });

  it('returns 503 and saves nothing when the photo upload fails', async () => {
    const { db, deps } = setup({ 'storage.upload': () => ({ error: { message: 'storage down' } }) });
    await expect(submitReport(deps, input)).rejects.toMatchObject({ status: 503 });
    expect(db.find('reports.insert')).toHaveLength(0);
  });

  it('deletes the uploaded photo when the report insert fails', async () => {
    const { db, admin, deps } = setup({ 'reports.insert': () => ({ error: { code: '42501', message: 'rls' } }) });
    await expect(submitReport(deps, input)).rejects.toMatchObject({ status: 403 });
    const uploadedPath = (db.find('storage.upload')[0].payload as { args: [string] }).args[0];
    expect((admin.find('storage.remove')[0].payload as { args: [string[]] }).args[0]).toEqual([uploadedPath]);
  });

  it('still succeeds when the stamp step fails after the report is saved', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { deps } = setup({ 'stamps.upsert': () => ({ error: { code: 'XX000', message: 'boom' } }) });
    const result = await submitReport(deps, input);
    expect(result.report.id).toBe('r1');
    expect(result.stampAwarded).toBe(false);
  });
});
