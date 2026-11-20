/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { ProviderSeed } from '@/lib/chatbot/data/provider';
import { SupabaseDataProvider, type SupabaseProviderOptions } from '@/lib/data/chatbotProvider';
import { contractSeed, runProviderContractTests } from './chatbot/provider.contract';
import { memorySupabase, tablesFromSeed, type Row } from './helpers/memorySupabase';

// The shared contract (tests/chatbot/provider.contract.ts), run against the real provider code
// over an in-memory copy of the seed tables. No remote database is touched.

type RpcHandler = Parameters<typeof memorySupabase>[1];

function build(seed: ProviderSeed, options: SupabaseProviderOptions = {}, rpc: RpcHandler = {}) {
  const memory = memorySupabase(tablesFromSeed(seed), rpc);
  const db = memory.client as unknown as SupabaseClient<Database>;
  return { provider: new SupabaseDataProvider(db, { now: () => seed.now, ...options }), memory };
}

runProviderContractTests('SupabaseDataProvider', (seed) => build(seed).provider);

describe('SupabaseDataProvider (Supabase specifics)', () => {
  const STATION_A = 'a0000000-0000-4000-8000-00000000000a';
  const WATER_1 = 'f1000000-0000-4000-8000-000000000001';
  const WATER_2 = 'f2000000-0000-4000-8000-000000000002';
  const CHARGING_1 = 'f3000000-0000-4000-8000-000000000003';

  it('never sends an id that is not a UUID to the database', async () => {
    const { provider, memory } = build(contractSeed());

    expect(await provider.listFacilities('station-manggarai', 'any')).toEqual([]);
    expect(await provider.getFacilityStatuses(['nope', "1' or '1'='1"])).toEqual([]);
    expect(await provider.getNextTrains('tebet', {})).toEqual({ dataAvailable: false, serviceEnded: false, departures: [] });
    expect(await provider.searchReviews('tebet', 'water', 'air', 5)).toEqual({ method: 'latest', reviews: [] });
    expect(await provider.getReviewStats('tebet', 'water')).toEqual({ count: 0, average: null });
    expect(memory.calls).toHaveLength(0);
  });

  it('searches by embedding, keeps only reviews of the requested type, and cuts to the limit', async () => {
    const vector = [0.1, 0.2, 0.3];
    const embedQuery = jest.fn().mockResolvedValue(vector);
    const match = (facility_id: string, rating: number, comment: string): Row => ({
      review_id: `r-${rating}`, facility_id, rating, comment, created_at: '2026-11-17T01:00:00.000Z', similarity: 0.9,
    });
    // match_reviews does not know facility types: the charging review ranks first.
    let rpcArgs: Record<string, unknown> | undefined;
    const matchReviews = (args: Record<string, unknown>) => {
      rpcArgs = args;
      return {
        data: [match(CHARGING_1, 3, 'Colokan longgar'), match(WATER_1, 5, 'Airnya dingin'), match(WATER_2, 4, 'Bersih')],
        error: null,
      };
    };
    const { provider } = build(contractSeed(), { embedQuery }, { match_reviews: matchReviews });

    const search = await provider.searchReviews(STATION_A, 'water', 'kualitas air', 1);

    expect(embedQuery).toHaveBeenCalledWith('kualitas air');
    expect(rpcArgs).toMatchObject({ p_station_id: STATION_A, match_count: 4 });
    expect(search).toEqual({
      method: 'semantic',
      reviews: [
        { facilityId: WATER_1, facilityName: 'Water Station', rating: 5, comment: 'Airnya dingin', createdAt: '2026-11-17T01:00:00.000Z' },
      ],
    });
  });

  it('falls back to the latest reviews when the search fails, and skips embedding for an empty query', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined); // the expected fallback notice
    const embedQuery = jest.fn().mockResolvedValue([0.1]);
    const { provider } = build(contractSeed(), { embedQuery }); // no match_reviews handler: the rpc errors

    expect((await provider.searchReviews(STATION_A, 'water', 'air', 5)).method).toBe('latest');
    embedQuery.mockClear();
    expect((await provider.searchReviews(STATION_A, 'water', '  ', 5)).method).toBe('latest');
    expect(embedQuery).not.toHaveBeenCalled();
  });
});
