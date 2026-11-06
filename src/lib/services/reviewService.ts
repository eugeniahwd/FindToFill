import { Review } from '../types';
import { MOCK_REVIEWS } from '../mock/data';
import { apiRequest, isMissing } from './apiClient';

export interface SubmitReviewResult {
  review: Review;
  /** false when the user edited their existing review for this facility. */
  created: boolean;
  /** True when this was the user's first report or review for the facility. */
  stampAwarded: boolean;
}

let dynamicReviews: Review[] = [...MOCK_REVIEWS];

export const reviewService = {
  /** Public: the station's reviews, newest first. */
  async getStationReviews(stationId: string): Promise<Review[]> {
    try {
      const { reviews } = await apiRequest<{ reviews: Review[] }>(
        `/api/stations/${encodeURIComponent(stationId)}/reviews`,
      );
      return reviews;
    } catch (err) {
      if (isMissing(err)) return [];
      throw err;
    }
  },

  /**
   * Creates the signed-in user's review for a facility, or edits it if they already
   * reviewed it. The user comes from the session cookie.
   */
  async submitReview(params: { facilityId: string; rating: number; comment: string }): Promise<SubmitReviewResult> {
    return apiRequest<SubmitReviewResult>('/api/reviews', {
      method: 'POST',
      body: { facilityId: params.facilityId, rating: params.rating, comment: params.comment.trim() },
    });
  },

  // ---------------------------------------------------------------------------
  // Still mock data until the admin moderation API (Sprint 6).
  // ---------------------------------------------------------------------------

  // TODO(backend): Replace with the admin moderation API (Sprint 6)
  async getAllReviews(): Promise<Review[]> {
    await new Promise((r) => setTimeout(r, 150));
    return [...dynamicReviews].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  // TODO(backend): Replace with the admin moderation API (Sprint 6)
  async removeReview(reviewId: string, adminId: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 200));
    dynamicReviews = dynamicReviews.map((r) =>
      r.id === reviewId ? { ...r, removedAt: new Date().toISOString(), removedBy: adminId } : r,
    );
  },

  // TODO(backend): Replace with the admin moderation API (Sprint 6)
  async restoreReview(reviewId: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 200));
    dynamicReviews = dynamicReviews.map((r) =>
      r.id === reviewId ? { ...r, removedAt: null, removedBy: null } : r,
    );
  },
};
