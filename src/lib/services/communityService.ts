import { Stamp } from '../types';
import { apiRequest } from './apiClient';

// Favorites and stamps of the signed-in user (session cookie). Stamps are awarded
// server-side by POST /api/reports and POST /api/reviews.

export const communityService = {
  /** Favorite station ids, newest first. */
  async getFavorites(): Promise<string[]> {
    const { stationIds } = await apiRequest<{ stationIds: string[] }>('/api/me/favorites');
    return stationIds;
  },

  /** Sets the favorite state and returns it. Safe to repeat. */
  async setFavorite(stationId: string, favorite: boolean): Promise<boolean> {
    const result = await apiRequest<{ favorite: boolean }>(`/api/me/favorites/${encodeURIComponent(stationId)}`, {
      method: favorite ? 'PUT' : 'DELETE',
    });
    return result.favorite;
  },

  async getUserStamps(): Promise<Stamp[]> {
    const { stamps } = await apiRequest<{ stamps: Stamp[] }>('/api/me/stamps');
    return stamps;
  },
};
