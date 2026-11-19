import { Review } from '../types';
import { apiRequest, isMissing } from './apiClient';

export interface SubmitReviewResult {
  review: Review;
  /** false when the user edited their existing review for this facility. */
  created: boolean;
  /** True when this was the user's first report or review for the facility. */
  stampAwarded: boolean;
}

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

  // Admin moderation lives in adminService.
};
