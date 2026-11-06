import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { Stamp } from '@/lib/types';
import { fromDatabaseError } from '@/lib/api/errors';

/** The user's stamps with each facility's station (for the Stamp Map). Uses the user's client (RLS: own rows). */
export async function listUserStamps(db: SupabaseClient<Database>, userId: string): Promise<Stamp[]> {
  const { data: stamps, error } = await db
    .from('stamps')
    .select('facility_id, stamped_at')
    .eq('user_id', userId)
    .order('stamped_at', { ascending: false });
  if (error) throw fromDatabaseError(error);
  if (stamps.length === 0) return [];

  const { data: facilities, error: facilityError } = await db
    .from('facilities')
    .select('id, station_id')
    .in(
      'id',
      stamps.map((s) => s.facility_id),
    );
  if (facilityError) throw fromDatabaseError(facilityError);

  const stationOf = new Map(facilities.map((f) => [f.id, f.station_id]));
  return stamps.map((s) => ({
    userId,
    facilityId: s.facility_id,
    stationId: stationOf.get(s.facility_id),
    stampedAt: s.stamped_at,
  }));
}

/**
 * Awards the user's stamp for a facility the first time they report or review it.
 * Needs the service-role client: users cannot insert stamps themselves (RLS).
 * Returns true only when a new stamp was created.
 */
export async function awardStamp(
  admin: SupabaseClient<Database>,
  userId: string,
  facilityId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('stamps')
    .upsert({ user_id: userId, facility_id: facilityId }, { onConflict: 'user_id,facility_id', ignoreDuplicates: true })
    .select('user_id');
  if (error) throw fromDatabaseError(error);
  return data.length > 0;
}
