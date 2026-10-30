import { Favorite, Stamp } from '../types';
import { MOCK_FAVORITES, MOCK_STAMPS, MOCK_FACILITIES } from '../mock/data';

const dynamicFavorites: Favorite[] = [...MOCK_FAVORITES];
const dynamicStamps: Stamp[] = [...MOCK_STAMPS];

export const communityService = {
  // TODO(backend): Replace with supabase.from('favorites').select('station_id').eq('user_id', userId)
  async getFavorites(userId: string): Promise<string[]> {
    await new Promise((r) => setTimeout(r, 100));
    return dynamicFavorites
      .filter((f) => f.userId === userId)
      .map((f) => f.stationId);
  },

  // TODO(backend): Replace with supabase.from('favorites').insert or delete
  async toggleFavorite(userId: string, stationId: string): Promise<boolean> {
    await new Promise((r) => setTimeout(r, 200));
    const index = dynamicFavorites.findIndex(
      (f) => f.userId === userId && f.stationId === stationId
    );

    if (index !== -1) {
      dynamicFavorites.splice(index, 1);
      return false; // unfavorited
    } else {
      dynamicFavorites.push({
        userId,
        stationId,
        createdAt: new Date().toISOString(),
      });
      return true; // favorited
    }
  },

  // TODO(backend): Replace with supabase.from('stamps').select('*, facilities(station_id)').eq('user_id', userId)
  async getUserStamps(userId: string): Promise<Stamp[]> {
    await new Promise((r) => setTimeout(r, 150));
    return dynamicStamps.filter((s) => s.userId === userId);
  },

  // TODO(backend): Awarded server-side via triggers or stored procedure
  async awardStamp(userId: string, facilityId: string): Promise<Stamp | null> {
    const existing = dynamicStamps.find(
      (s) => s.userId === userId && s.facilityId === facilityId
    );
    if (existing) return null;

    const fac = MOCK_FACILITIES.find((f) => f.id === facilityId);
    const newStamp: Stamp = {
      userId,
      facilityId,
      stationId: fac?.stationId,
      stampedAt: new Date().toISOString(),
    };
    dynamicStamps.push(newStamp);
    return newStamp;
  },
};
