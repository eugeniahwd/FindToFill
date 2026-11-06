import { reviewService } from '@/lib/services/reviewService';
import { communityService } from '@/lib/services/communityService';
import { ApiRequestError } from '@/lib/services/apiClient';
import { reviewErrorMessage } from '@/lib/reviews/messages';
import { stationLevels } from '@/components/facility/StationLayoutMap';
import type { FacilityWithStatus } from '@/lib/types';

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

function respond(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);
}

describe('reviewService (browser)', () => {
  it('posts JSON with the trimmed comment and no user id', async () => {
    fetchMock.mockReturnValue(respond(201, { review: { id: 'rev-1' }, created: true, stampAwarded: true }));
    const result = await reviewService.submitReview({ facilityId: 'f1', rating: 4, comment: '  Segar  ' });

    expect(result).toMatchObject({ created: true, stampAwarded: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/reviews');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ facilityId: 'f1', rating: 4, comment: 'Segar' });
  });

  it('loads station reviews and treats an unknown station as empty', async () => {
    fetchMock.mockReturnValueOnce(respond(200, { reviews: [{ id: 'rev-1' }] }));
    expect(await reviewService.getStationReviews('s1')).toEqual([{ id: 'rev-1' }]);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/stations/s1/reviews');

    fetchMock.mockReturnValueOnce(respond(404, { error: { code: 'NOT_FOUND', message: 'x' } }));
    expect(await reviewService.getStationReviews('nope')).toEqual([]);
  });
});

describe('communityService (browser)', () => {
  it('uses PUT to favorite and DELETE to unfavorite', async () => {
    fetchMock.mockReturnValueOnce(respond(200, { favorite: true }));
    expect(await communityService.setFavorite('s1', true)).toBe(true);
    expect(fetchMock.mock.calls[0]).toEqual(['/api/me/favorites/s1', expect.objectContaining({ method: 'PUT' })]);

    fetchMock.mockReturnValueOnce(respond(200, { favorite: false }));
    expect(await communityService.setFavorite('s1', false)).toBe(false);
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
  });
});

describe('reviewErrorMessage', () => {
  it.each([
    ['RATE_LIMITED', 429, /Terlalu banyak ulasan/],
    ['CONFLICT', 409, /dihapus moderator/],
    ['UNAUTHORIZED', 401, /masuk lagi/],
  ])('maps %s to Indonesian text', (code, status, expected) => {
    expect(reviewErrorMessage(new ApiRequestError(status, code, 'x'))).toMatch(expected);
  });
});

describe('stationLevels (layout tabs)', () => {
  const fac = (level?: string) => ({ level }) as FacilityWithStatus;

  it('uses the layout images when the station has any', () => {
    expect(stationLevels([{ id: 'a', stationId: 's', level: 'L2' }, { id: 'b', stationId: 's', level: 'L1' }], [])).toEqual(['L1', 'L2']);
  });

  it('falls back to the facility levels (default L1), without duplicates', () => {
    expect(stationLevels([], [fac('L2'), fac(undefined), fac('L1'), fac('L2')])).toEqual(['L1', 'L2']);
  });
});
