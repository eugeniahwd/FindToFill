import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { fromDatabaseError } from '@/lib/api/errors';

// Favorite stations. Every call uses the user's own client: RLS allows only own rows.

type Db = SupabaseClient<Database>;

export async function listFavoriteStationIds(db: Db, userId: string): Promise<string[]> {
  const { data, error } = await db
    .from('favorites')
    .select('station_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw fromDatabaseError(error);
  return data.map((row) => row.station_id);
}

/** Idempotent: favoriting an already favorite station succeeds. */
export async function addFavorite(db: Db, userId: string, stationId: string): Promise<void> {
  const { error } = await db.from('favorites').insert({ user_id: userId, station_id: stationId });
  if (error && error.code !== '23505') throw fromDatabaseError(error);
}

/** Idempotent: removing a station that is not a favorite succeeds. */
export async function removeFavorite(db: Db, userId: string, stationId: string): Promise<void> {
  const { error } = await db.from('favorites').delete().eq('user_id', userId).eq('station_id', stationId);
  if (error) throw fromDatabaseError(error);
}
