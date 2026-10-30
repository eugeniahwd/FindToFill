import { Review } from '../types';
import { MOCK_REVIEWS, MOCK_FACILITIES } from '../mock/data';
import { communityService } from './communityService';

let dynamicReviews: Review[] = [...MOCK_REVIEWS];

export const reviewService = {
  // TODO(backend): Replace with supabase.from('reviews').select('*, facilities!inner(station_id)').eq('facilities.station_id', stationId).is('removed_at', null)
  async getStationReviews(stationId: string): Promise<Review[]> {
    await new Promise((r) => setTimeout(r, 150));
    const stationFacilityIds = MOCK_FACILITIES.filter(
      (f) => f.stationId === stationId
    ).map((f) => f.id);

    return dynamicReviews
      .filter((rev) => stationFacilityIds.includes(rev.facilityId) && !rev.removedAt)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  },

  // TODO(backend): Replace with supabase.from('reviews').select('*').eq('facility_id', facilityId).is('removed_at', null)
  async getFacilityReviews(facilityId: string): Promise<Review[]> {
    await new Promise((r) => setTimeout(r, 100));
    return dynamicReviews
      .filter((r) => r.facilityId === facilityId && !r.removedAt)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  },

  // TODO(backend): Replace with supabase.from('reviews').select('*, facilities(name, station_id), profiles(display_name)')
  async getAllReviews(): Promise<Review[]> {
    await new Promise((r) => setTimeout(r, 150));
    return [...dynamicReviews].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  // TODO(backend): Replace with supabase.from('reviews').upsert(...) with embedding generation
  async addReview(params: {
    facilityId: string;
    userId: string;
    userName?: string;
    rating: number;
    comment: string;
  }): Promise<Review> {
    await new Promise((r) => setTimeout(r, 300));
    const newRev: Review = {
      id: `rev-${Date.now()}`,
      facilityId: params.facilityId,
      userId: params.userId,
      userName: params.userName || 'Anonymous Commuter',
      rating: Math.max(1, Math.min(5, params.rating)),
      comment: params.comment.trim().slice(0, 500),
      createdAt: new Date().toISOString(),
    };

    dynamicReviews = [newRev, ...dynamicReviews];

    // Award stamp for first review
    await communityService.awardStamp(params.userId, params.facilityId);

    return newRev;
  },

  // TODO(backend): Replace with supabase.from('reviews').update({ removed_at: now(), removed_by: adminId }).eq('id', id)
  async removeReview(reviewId: string, adminId: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 200));
    const index = dynamicReviews.findIndex((r) => r.id === reviewId);
    if (index !== -1) {
      dynamicReviews[index] = {
        ...dynamicReviews[index],
        removedAt: new Date().toISOString(),
        removedBy: adminId,
      };
    }
  },

  // TODO(backend): Replace with supabase admin action
  async restoreReview(reviewId: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 200));
    const index = dynamicReviews.findIndex((r) => r.id === reviewId);
    if (index !== -1) {
      dynamicReviews[index] = {
        ...dynamicReviews[index],
        removedAt: null,
        removedBy: null,
      };
    }
  },
};
