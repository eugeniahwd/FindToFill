import { stationService } from '@/lib/services/stationService';
import { ApiRequestError } from '@/lib/services/apiClient';
import type { FacilityWithStatus } from '@/lib/types';

const facility = {
  id: 'f1',
  name: 'W1',
  type: 'water',
  latitude: -6.2094,
  longitude: 106.8502,
  currentStatus: 'unknown',
} as FacilityWithStatus;

function respond(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);
}

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

describe('stationService (browser side of the API)', () => {
  it('adds distances locally and never sends coordinates to the server', async () => {
    fetchMock.mockReturnValue(respond(200, { facilities: [facility] }));
    const [f] = await stationService.getStationFacilities('s1', { latitude: -6.2099, longitude: 106.8502 });

    expect(f.distanceMeters).toBeGreaterThan(50);
    expect(f.distanceMeters).toBeLessThan(60);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/stations/s1/facilities');
    expect(JSON.stringify(init)).not.toContain('6.2099');
  });

  it('returns null / [] for unknown or old mock ids (404 or 400)', async () => {
    fetchMock.mockReturnValue(respond(400, { error: { code: 'VALIDATION_ERROR', message: 'id: Invalid UUID' } }));
    expect(await stationService.getStationById('station-manggarai')).toBeNull();
    expect(await stationService.getStationFacilities('station-manggarai')).toEqual([]);

    fetchMock.mockReturnValue(respond(404, { error: { code: 'NOT_FOUND', message: 'Facility not found.' } }));
    expect(await stationService.getFacilityById('f-missing')).toBeNull();
  });

  it('surfaces other errors with the API code and message', async () => {
    fetchMock.mockReturnValue(respond(503, { error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unreachable.' } }));
    await expect(stationService.getStations()).rejects.toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Database unreachable.',
    });

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(stationService.getStations()).rejects.toBeInstanceOf(ApiRequestError);
  });

  it('sends only editable fields when an admin updates a facility', async () => {
    fetchMock.mockReturnValue(respond(200, { facility: { ...facility, name: 'New' } }));
    await stationService.updateFacility('f1', { name: 'New', isDemoData: false, stationId: 'x' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/admin/facilities/f1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ name: 'New' });
  });
});
