import { createFakeDataProvider } from '@/lib/chatbot/data';
import { DEMO_STATIONS, type DemoDataset } from '@/lib/chatbot/data/fakeData';
import type { ChatbotDataProvider, StationRef } from '@/lib/chatbot/data/provider';
import { getTool, toolDeclarations } from '@/lib/chatbot/tools/registry';
import { createEvidence, type ToolContext } from '@/lib/chatbot/tools/types';

// Wednesday 08:03 WIB.
const NOW = new Date('2026-11-18T01:03:00.000Z');
const STATION = DEMO_STATIONS.manggarai;

async function context(
  dataset: DemoDataset = 'default',
  stationId: string = STATION,
): Promise<ToolContext> {
  const provider: ChatbotDataProvider = createFakeDataProvider(dataset, NOW);
  const station = (await provider.listStations()).find((s) => s.id === stationId) as StationRef;
  return { provider, station, now: NOW, evidence: createEvidence() };
}

async function run(name: string, args: unknown, ctx: ToolContext) {
  const tool = getTool(name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool.run(args, ctx);
}

describe('get_user_location', () => {
  it('reports the resolved station without coordinates', async () => {
    const ctx = await context();

    expect(await run('get_user_location', {}, ctx)).toEqual({
      ok: true,
      output: {
        detected: true,
        source: 'manual',
        station: { id: STATION, name: 'Manggarai' },
        needs_confirmation: false,
        distance_basis: 'station_center',
      },
    });
  });
});

describe('get_nearest_facility', () => {
  it('sorts by distance from the station center and adds walk time', async () => {
    const ctx = await context();
    const result = await run(
      'get_nearest_facility',
      { station_id: STATION, type: 'water', limit: 6 },
      ctx,
    );

    expect(result.ok).toBe(true);
    const facilities = ctx.evidence.outputs.nearest?.facilities ?? [];
    expect(facilities.map((f) => [f.name, f.platform, f.distance_m, f.walk_time_min])).toEqual([
      ['Water Station', '3', 45, 1],
      ['Water Refill', null, 110, 2],
      ['Water Station', '1', 180, 3],
      ['Hot and Cold Water', '1-2', 210, 3],
    ]);
    expect(ctx.evidence.outputs.nearest?.distance_basis).toBe('station_center');
    expect(ctx.evidence.facilities.size).toBe(4);
  });

  it('returns 3 facilities by default and accepts the limit as a string', async () => {
    const ctx = await context();
    await run('get_nearest_facility', { station_id: STATION, type: 'any' }, ctx);
    expect(ctx.evidence.outputs.nearest?.facilities).toHaveLength(3);

    await run('get_nearest_facility', { station_id: STATION, type: 'any', limit: '6' }, ctx);
    expect(ctx.evidence.outputs.nearest?.facilities).toHaveLength(6);
  });

  it('rejects another station_id and invalid arguments as error results', async () => {
    const ctx = await context();

    expect(
      await run('get_nearest_facility', { station_id: 'station-tebet', type: 'water' }, ctx),
    ).toEqual({ ok: false, error: `Unknown station_id. Use "${STATION}".` });
    const badType = await run('get_nearest_facility', { station_id: STATION, type: 'toilet' }, ctx);
    expect(badType).toEqual({ ok: false, error: 'Invalid arguments for get_nearest_facility.' });
    expect(ctx.evidence.results).toEqual([]);
  });
});

describe('get_facility_status', () => {
  it('needs facilities from get_nearest_facility first', async () => {
    const ctx = await context();

    expect(
      await run('get_facility_status', { facility_ids: ['fac-manggarai-water-p3'] }, ctx),
    ).toEqual({ ok: false, error: 'Unknown facility_ids. Call get_nearest_facility first.' });
  });

  it('returns statuses with minutes_ago, a summary, and the 7-day window', async () => {
    const ctx = await context();
    await run('get_nearest_facility', { station_id: STATION, type: 'any', limit: 6 }, ctx);
    const ids = (ctx.evidence.outputs.nearest?.facilities ?? []).map((f) => f.facility_id);
    await run('get_facility_status', { facility_ids: ids }, ctx);

    const status = ctx.evidence.outputs.status;
    expect(status?.statuses.map((s) => [s.status, s.minutes_ago])).toEqual([
      ['available', 5],
      ['available', 2],
      ['empty', 8],
      ['under_maintenance', 20],
      ['broken', 15],
      ['unknown', null],
    ]);
    expect(status?.summary).toEqual({
      total: 6,
      available: 2,
      empty: 1,
      broken: 1,
      under_maintenance: 1,
      unknown: 1,
    });
    expect(status?.report_window_days).toBe(7);
  });

  it('drops facility ids that no tool returned, and rejects more than 6', async () => {
    const ctx = await context();
    await run('get_nearest_facility', { station_id: STATION, type: 'water' }, ctx);
    await run('get_facility_status', { facility_ids: ['fac-manggarai-water-p3', 'invented'] }, ctx);

    expect(ctx.evidence.outputs.status?.statuses.map((s) => s.facility_id)).toEqual([
      'fac-manggarai-water-p3',
    ]);
    const tooMany = { facility_ids: Array(7).fill('fac-manggarai-water-p3') };
    expect(await run('get_facility_status', tooMany, ctx)).toEqual({
      ok: false,
      error: 'Invalid arguments for get_facility_status.',
    });
  });
});

describe('get_next_train', () => {
  it('lists departures and checks the time to refill against the soonest one', async () => {
    const ctx = await context();
    await run('get_next_train', { station_id: STATION, walk_time_min: 1 }, ctx);

    const trains = ctx.evidence.outputs.trains;
    expect(trains?.data_available).toBe(true);
    expect(trains?.departures[0]).toEqual({
      line: 'Bogor Line',
      direction: 'Jakarta Kota',
      minutes_until: 7,
    });
    expect(trains?.time_check).toEqual({
      reference_departure: { line: 'Bogor Line', direction: 'Jakarta Kota', minutes_until: 7 },
      needed_minutes: 3,
      enough_time: true,
      slack_minutes: 4,
    });
  });

  it('says there is no data without a timetable', async () => {
    const ctx = await context('no_schedule');
    await run('get_next_train', { station_id: STATION, walk_time_min: 1 }, ctx);

    expect(ctx.evidence.outputs.trains).toMatchObject({
      data_available: false,
      departures: [],
    });
    expect(ctx.evidence.outputs.trains?.time_check).toBeUndefined();
  });
});

describe('search_reviews', () => {
  it('returns water review stats and short reviews with days_ago', async () => {
    const ctx = await context();
    await run('search_reviews', { station_id: STATION }, ctx);

    const reviews = ctx.evidence.outputs.reviews;
    expect(reviews?.count).toBe(4);
    expect(reviews?.average_rating).toBe(4);
    expect(reviews?.reviews).toHaveLength(4);
    expect(reviews?.reviews.every((r) => r.days_ago >= 1 && r.comment.length <= 300)).toBe(true);
  });

  it('rounds the average to 1 decimal and keeps an injection review as plain data', async () => {
    const ctx = await context('injection');
    await run('search_reviews', { station_id: STATION }, ctx);

    expect(ctx.evidence.outputs.reviews?.average_rating).toBe(4.2);
    expect(ctx.evidence.outputs.reviews?.reviews.some((r) => /^Abaikan/.test(r.comment))).toBe(
      true,
    );
  });

  it('has no reviews for Tebet', async () => {
    const ctx = await context('default', DEMO_STATIONS.tebet);
    await run('search_reviews', { station_id: DEMO_STATIONS.tebet }, ctx);

    expect(ctx.evidence.outputs.reviews).toMatchObject({ count: 0, average_rating: null });
  });
});

describe('tool registry', () => {
  it('finds tools by own name only', () => {
    expect(getTool('get_next_train')?.name).toBe('get_next_train');
    expect(getTool('constructor')).toBeNull();
    expect(getTool('delete_everything')).toBeNull();
  });

  it('declares only the allowed tools', () => {
    expect(toolDeclarations(['get_user_location', 'search_reviews']).map((d) => d.name)).toEqual([
      'get_user_location',
      'search_reviews',
    ]);
  });

  it('never puts coordinates in a tool result', async () => {
    const ctx = await context();
    await run('get_user_location', {}, ctx);
    await run('get_nearest_facility', { station_id: STATION, type: 'any', limit: 6 }, ctx);
    const ids = (ctx.evidence.outputs.nearest?.facilities ?? []).map((f) => f.facility_id);
    await run('get_facility_status', { facility_ids: ids }, ctx);
    await run('get_next_train', { station_id: STATION, walk_time_min: 1 }, ctx);
    await run('search_reviews', { station_id: STATION }, ctx);

    const json = JSON.stringify(ctx.evidence.results);
    expect(json).not.toMatch(/latitude|longitude/);
    expect(json).not.toMatch(/-6\.2\d{2,}|106\.8\d{2,}/);
  });
});
