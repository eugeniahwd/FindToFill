/**
 * @jest-environment node
 */
import { POST as postReport } from '@/app/api/reports/route';
import { GET as getMyReports } from '@/app/api/me/reports/route';
import { requireUser } from '@/lib/auth/session';
import { listUserReports, submitReport } from '@/lib/data/reports';
import { ApiError } from '@/lib/api/errors';

jest.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: jest.fn(async () => ({})) }));
jest.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: jest.fn(() => ({})) }));
jest.mock('@/lib/auth/session');
jest.mock('@/lib/data/reports');

const USER = { id: '11111111-1111-4111-8111-111111111111', email: null, displayName: null, role: 'commuter' as const };
const FACILITY = '22222222-2222-4222-8222-222222222222';
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const GIF = new TextEncoder().encode('GIF89a......');

function reportRequest(fields: Record<string, string | Blob | undefined>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) form.set(key, value);
  }
  return new Request('http://localhost/api/reports', { method: 'POST', body: form });
}
const valid = () => ({ facilityId: FACILITY, status: 'empty', note: 'Galon habis', photo: new Blob([JPEG], { type: 'image/jpeg' }) });

async function json(res: Response) {
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(requireUser).mockResolvedValue(USER);
});

describe('POST /api/reports', () => {
  it('rejects guests with 401 and saves nothing', async () => {
    jest.mocked(requireUser).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Please log in first.'));
    expect((await postReport(reportRequest(valid()))).status).toBe(401);
    expect(submitReport).not.toHaveBeenCalled();
  });

  it('requires a photo', async () => {
    const { status, body } = await json(await postReport(reportRequest({ ...valid(), photo: undefined })));
    expect(status).toBe(400);
    expect(body.error.message).toBe('A photo is required.');
    expect(submitReport).not.toHaveBeenCalled();
  });

  it('rejects a non-image renamed to .jpg with 415 (content is checked, not the name)', async () => {
    const fake = new File([GIF], 'photo.jpg', { type: 'image/jpeg' });
    const { status, body } = await json(await postReport(reportRequest({ ...valid(), photo: fake })));
    expect(status).toBe(415);
    expect(body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects photos over 5 MB with 413', async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(JPEG);
    expect((await postReport(reportRequest({ ...valid(), photo: new Blob([big]) }))).status).toBe(413);
  });

  it.each([
    ['an unknown status', { status: 'kosong' }],
    ['a note over 140 characters', { note: 'x'.repeat(141) }],
    ['a facility id that is not a UUID', { facilityId: 'fac-mri-01' }],
  ])('returns 400 for %s', async (_case, override) => {
    const { status, body } = await json(await postReport(reportRequest({ ...valid(), ...override })));
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(submitReport).not.toHaveBeenCalled();
  });

  it('saves a valid report and returns 201 with the stamp flag', async () => {
    jest.mocked(submitReport).mockResolvedValue({
      report: { id: 'r1', facilityId: FACILITY, userId: USER.id, status: 'empty', photoUrl: 'https://signed', createdAt: 'now' },
      stampAwarded: true,
    });
    const { status, body } = await json(await postReport(reportRequest(valid())));

    expect(status).toBe(201);
    expect(body.stampAwarded).toBe(true);
    const [, args] = jest.mocked(submitReport).mock.calls[0];
    expect(args.userId).toBe(USER.id);
    expect(args.fields).toEqual({ facilityId: FACILITY, status: 'empty', note: 'Galon habis' });
    expect(args.photo.type).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
  });

  it('passes the rate-limit error through as 429', async () => {
    jest.mocked(submitReport).mockRejectedValue(new ApiError(429, 'RATE_LIMITED', 'Limit reached.'));
    expect((await postReport(reportRequest(valid()))).status).toBe(429);
  });
});

describe('GET /api/me/reports', () => {
  it('returns 401 for guests', async () => {
    jest.mocked(requireUser).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Please log in first.'));
    expect((await getMyReports()).status).toBe(401);
  });

  it("returns the signed-in user's reports", async () => {
    jest.mocked(listUserReports).mockResolvedValue([]);
    expect(await json(await getMyReports())).toEqual({ status: 200, body: { reports: [] } });
    expect(jest.mocked(listUserReports).mock.calls[0][1]).toBe(USER.id);
  });
});
