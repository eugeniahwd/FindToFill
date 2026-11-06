import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { fromDatabaseError } from '@/lib/api/errors';

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
