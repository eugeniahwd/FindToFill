import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { Facility, FacilityWithStatus, Station, StationLayout } from '@/lib/types';
import { fromDatabaseError } from '@/lib/api/errors';
import { toFacility, toStation, toStationLayout, withStatus } from './mappers';
import { signReportPhotos } from './photos';

// Read access to stations and facilities. Every function takes the caller's client, so RLS
// applies: pass the request client from createSupabaseServerClient().
// Also intended for the chatbot tools (get_user_location, get_nearest_facility, get_facility_status).

type Db = SupabaseClient<Database>;

export async function listStations(db: Db): Promise<Station[]> {
  const { data, error } = await db.from('stations').select('*').order('name');
  if (error) throw fromDatabaseError(error);
  return data.map(toStation);
}

export async function getStation(db: Db, stationId: string): Promise<Station | null> {
  const { data, error } = await db.from('stations').select('*').eq('id', stationId).maybeSingle();
  if (error) throw fromDatabaseError(error);
  return data ? toStation(data) : null;
}

export async function listStationLayouts(db: Db, stationId: string): Promise<StationLayout[]> {
  const { data, error } = await db.from('station_layouts').select('*').eq('station_id', stationId).order('level');
  if (error) throw fromDatabaseError(error);
  return data.map(toStationLayout);
}

/** Active facilities of a station with their current status (7-day window). Not sorted by distance. */
export async function listStationFacilities(db: Db, stationId: string): Promise<FacilityWithStatus[]> {
  const { data, error } = await db
    .from('facilities')
    .select('*')
    .eq('station_id', stationId)
    .eq('is_active', true)
    .order('name');
  if (error) throw fromDatabaseError(error);
  return attachStatus(db, data.map(toFacility));
}

export async function getFacility(db: Db, facilityId: string): Promise<FacilityWithStatus | null> {
  const { data, error } = await db
    .from('facilities')
    .select('*')
    .eq('id', facilityId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw fromDatabaseError(error);
  if (!data) return null;
  const [facility] = await attachStatus(db, [toFacility(data)]);
  return facility;
}

export async function getFacilitiesStatus(db: Db, facilityIds: string[]): Promise<FacilityWithStatus[]> {
  if (facilityIds.length === 0) return [];
  const { data, error } = await db.from('facilities').select('*').in('id', facilityIds).eq('is_active', true);
  if (error) throw fromDatabaseError(error);
  return attachStatus(db, data.map(toFacility));
}

async function attachStatus(db: Db, facilities: Facility[]): Promise<FacilityWithStatus[]> {
  if (facilities.length === 0) return [];

  const { data: statuses, error } = await db
    .from('facility_status')
    .select('*')
    .in(
      'facility_id',
      facilities.map((f) => f.id),
    );
  if (error) throw fromDatabaseError(error);

  const statusById = new Map(statuses.map((s) => [s.facility_id, s]));
  const photoUrls = await signReportPhotos(
    statuses.flatMap((s) => (s.status && s.photo_path ? [s.photo_path] : [])),
  );

  return facilities.map((facility) => {
    const status = statusById.get(facility.id);
    const photoUrl = status?.photo_path ? (photoUrls.get(status.photo_path) ?? null) : null;
    return withStatus(facility, status, photoUrl);
  });
}
