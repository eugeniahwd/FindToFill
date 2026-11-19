/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { listAllStationFacilities, listStationFacilities } from '@/lib/data/stations';
import { fakeSupabase } from './helpers/fakeSupabase';

// The admin list must include inactive facilities (so they can be switched back on),
// while the public list keeps hiding them.

const STATION = '33333333-3333-4333-8333-333333333333';

const row = (id: string, name: string, isActive: boolean) => ({
  id, station_id: STATION, type: 'water' as const, name, platform: null, location_detail: null, level: 'L1',
  latitude: -6.2, longitude: 106.8, layout_x: null, layout_y: null, is_active: isActive, is_demo_data: true,
});

function db() {
  const fake = fakeSupabase({
    'facilities.select': () => ({ data: [row('f1', 'Dispenser A', true), row('f2', 'Dispenser Lama', false)] }),
    'facility_status.select': () => ({ data: [] }),
  });
  return { fake, client: fake.client as unknown as SupabaseClient<Database> };
}

describe('listAllStationFacilities (admin)', () => {
  it('does not filter on is_active and returns inactive facilities with an unknown status', async () => {
    const { fake, client } = db();
    const facilities = await listAllStationFacilities(client, STATION);

    expect(fake.calls[0].filters).toEqual([['eq', 'station_id', STATION]]);
    expect(facilities.map((f) => [f.id, f.isActive, f.currentStatus])).toEqual([
      ['f1', true, 'unknown'],
      ['f2', false, 'unknown'],
    ]);
  });

  it('leaves the public list filtered to active facilities', async () => {
    const { fake, client } = db();
    await listStationFacilities(client, STATION);
    expect(fake.calls[0].filters).toContainEqual(['eq', 'is_active', true]);
  });
});
