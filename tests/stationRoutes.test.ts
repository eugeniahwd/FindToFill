/**
 * @jest-environment node
 */
import { GET as getStations } from '@/app/api/stations/route';
import { GET as getStationDetail } from '@/app/api/stations/[id]/route';
import { GET as getStationFacilities } from '@/app/api/stations/[id]/facilities/route';
import { GET as getFacilityDetail } from '@/app/api/facilities/[id]/route';
import * as data from '@/lib/data/stations';
import { fromDatabaseError } from '@/lib/api/errors';
import type { FacilityWithStatus, Station } from '@/lib/types';

jest.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: jest.fn(async () => ({})) }));
jest.mock('@/lib/data/stations');

const mocked = jest.mocked(data);
const STATION_ID = '3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const station: Station = { id: STATION_ID, name: 'Manggarai', lines: [], latitude: -6.2, longitude: 106.85, isPilot: true };
const facility = { id: 'f1', name: 'W1', currentStatus: 'unknown' } as FacilityWithStatus;

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = new Request('http://localhost/api');

async function json(res: Response) {
  return { status: res.status, body: await res.json() };
}

beforeEach(() => jest.resetAllMocks());

describe('GET /api/stations', () => {
  it('returns all stations', async () => {
    mocked.listStations.mockResolvedValue([station]);
    expect(await json(await getStations())).toEqual({ status: 200, body: { stations: [station] } });
  });

  it('returns 503 with a friendly message when the database is unreachable', async () => {
    mocked.listStations.mockRejectedValue(fromDatabaseError({ message: 'TypeError: fetch failed' }));
    const { status, body } = await json(await getStations());
    expect(status).toBe(503);
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(JSON.stringify(body)).not.toContain('fetch failed');
  });
});

describe('id validation', () => {
  it.each([
    ['station detail', getStationDetail],
    ['station facilities', getStationFacilities],
    ['facility detail', getFacilityDetail],
  ])('%s rejects a non-UUID id with 400 before touching the database', async (_name, handler) => {
    const { status, body } = await json(await handler(req, ctx('station-manggarai')));
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(mocked.getStation).not.toHaveBeenCalled();
    expect(mocked.getFacility).not.toHaveBeenCalled();
  });
});

describe('GET /api/stations/[id]', () => {
  it('returns the station with its layouts', async () => {
    mocked.getStation.mockResolvedValue(station);
    mocked.listStationLayouts.mockResolvedValue([]);
    expect(await json(await getStationDetail(req, ctx(STATION_ID)))).toEqual({
      status: 200,
      body: { station, layouts: [] },
    });
  });

  it('returns 404 for an unknown station', async () => {
    mocked.getStation.mockResolvedValue(null);
    mocked.listStationLayouts.mockResolvedValue([]);
    const { status, body } = await json(await getStationDetail(req, ctx(STATION_ID)));
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/stations/[id]/facilities', () => {
  it('returns facilities with status and no distance (computed in the browser)', async () => {
    mocked.getStation.mockResolvedValue(station);
    mocked.listStationFacilities.mockResolvedValue([facility]);
    expect(await json(await getStationFacilities(req, ctx(STATION_ID)))).toEqual({
      status: 200,
      body: { facilities: [facility] },
    });
  });

  it('returns 404 for an unknown station', async () => {
    mocked.getStation.mockResolvedValue(null);
    mocked.listStationFacilities.mockResolvedValue([]);
    expect((await getStationFacilities(req, ctx(STATION_ID))).status).toBe(404);
  });
});

describe('GET /api/facilities/[id]', () => {
  it('returns the facility', async () => {
    mocked.getFacility.mockResolvedValue(facility);
    expect(await json(await getFacilityDetail(req, ctx(STATION_ID)))).toEqual({ status: 200, body: { facility } });
  });

  it('returns 404 when missing or inactive', async () => {
    mocked.getFacility.mockResolvedValue(null);
    expect((await getFacilityDetail(req, ctx(STATION_ID))).status).toBe(404);
  });
});
