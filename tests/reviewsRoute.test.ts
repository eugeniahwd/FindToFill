/**
 * @jest-environment node
 */
import { POST as postReview } from '@/app/api/reviews/route';
import { GET as getStationReviews } from '@/app/api/stations/[id]/reviews/route';
import { requireUser } from '@/lib/auth/session';
import { listStationReviews, submitReview } from '@/lib/data/reviews';
import { getStation } from '@/lib/data/stations';
import { ApiError } from '@/lib/api/errors';

jest.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: jest.fn(async () => ({})) }));
jest.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: jest.fn(() => ({})) }));
jest.mock('@/lib/gemini/embeddings', () => ({ embedText: jest.fn() }));
jest.mock('@/lib/auth/session');
jest.mock('@/lib/data/reviews');
jest.mock('@/lib/data/stations');

const USER = { id: '11111111-1111-4111-8111-111111111111', email: null, displayName: null, role: 'commuter' as const };
const FACILITY = '22222222-2222-4222-8222-222222222222';
const STATION = '33333333-3333-4333-8333-333333333333';
const valid = { facilityId: FACILITY, rating: 5, comment: '  Airnya segar  ' };
const review = { id: 'rev-1', facilityId: FACILITY, userId: USER.id, rating: 5, comment: 'Airnya segar', createdAt: 'now' };

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function json(res: Response) {
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(requireUser).mockResolvedValue(USER);
});

describe('POST /api/reviews', () => {
  it('rejects guests with 401 and saves nothing', async () => {
    jest.mocked(requireUser).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Please log in first.'));
    expect((await postReview(jsonRequest(valid))).status).toBe(401);
    expect(submitReview).not.toHaveBeenCalled();
  });

  it('returns 201 for a new review with the trimmed comment and the session user', async () => {
    jest.mocked(submitReview).mockResolvedValue({ review, created: true, stampAwarded: true });
    const { status, body } = await json(await postReview(jsonRequest(valid)));

    expect(status).toBe(201);
    expect(body).toMatchObject({ created: true, stampAwarded: true });
    const [, args] = jest.mocked(submitReview).mock.calls[0];
    expect(args).toEqual({ userId: USER.id, input: { facilityId: FACILITY, rating: 5, comment: 'Airnya segar' } });
  });

  it('returns 200 for an edit', async () => {
    jest.mocked(submitReview).mockResolvedValue({ review, created: false, stampAwarded: false });
    expect((await postReview(jsonRequest(valid))).status).toBe(200);
  });

  it.each([
    ['rating 0', { rating: 0 }],
    ['rating 6', { rating: 6 }],
    ['a fractional rating', { rating: 3.5 }],
    ['an empty comment', { comment: '   ' }],
    ['a comment over 500 characters', { comment: 'x'.repeat(501) }],
    ['a facility id that is not a UUID', { facilityId: 'fac-mri-01' }],
    ['a spoofed user id', { userId: '99999999-9999-4999-8999-999999999999' }],
  ])('returns 400 for %s', async (_case, override) => {
    const { status, body } = await json(await postReview(jsonRequest({ ...valid, ...override })));
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(submitReview).not.toHaveBeenCalled();
  });

  it('accepts exactly 500 characters', async () => {
    jest.mocked(submitReview).mockResolvedValue({ review, created: true, stampAwarded: false });
    expect((await postReview(jsonRequest({ ...valid, comment: 'x'.repeat(500) }))).status).toBe(201);
  });

  it('returns 400 for a body that is not JSON', async () => {
    expect((await postReview(jsonRequest('rating=5'))).status).toBe(400);
  });
});

describe('GET /api/stations/:id/reviews', () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

  it('lists the station reviews for guests', async () => {
    jest.mocked(getStation).mockResolvedValue({ id: STATION, name: 'Tebet', lines: [], latitude: 0, longitude: 0, isPilot: true });
    jest.mocked(listStationReviews).mockResolvedValue([review]);
    expect(await json(await getStationReviews(new Request('http://localhost'), ctx(STATION)))).toEqual({
      status: 200,
      body: { reviews: [review] },
    });
  });

  it('returns 404 for an unknown station and 400 for a bad id', async () => {
    jest.mocked(getStation).mockResolvedValue(null);
    jest.mocked(listStationReviews).mockResolvedValue([]);
    expect((await getStationReviews(new Request('http://localhost'), ctx(STATION))).status).toBe(404);
    expect((await getStationReviews(new Request('http://localhost'), ctx('tebet'))).status).toBe(400);
  });
});
