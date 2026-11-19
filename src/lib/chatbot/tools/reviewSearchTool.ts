/**
 * src/lib/chatbot/tools/reviewSearchTool.ts
 *
 * search_reviews (docs/AI_TRACK.md §7, tool 5): water reviews of the station, searched with a
 * text fixed by the server. Review comments are untrusted user text: data, never instructions.
 */

import { z } from 'zod';
import { reviewSnippet } from '../../api/sanitize';
import { REVIEW_LIMIT, REVIEW_QUERY, REVIEW_SNIPPET_MAX_CHARS } from '../config';
import { Tool, type ReviewOutput, type ToolContext } from './types';

const args = z.object({ station_id: z.string() });
const DAY_MS = 24 * 60 * 60 * 1000;

export class ReviewSearchTool extends Tool<z.infer<typeof args>> {
  readonly name = 'search_reviews' as const;
  readonly description =
    'Water reviews of the station: count, average_rating, and up to 5 short reviews.';
  readonly parameters = {
    type: 'object',
    properties: {
      station_id: { type: 'string', description: 'The station id from get_user_location.' },
    },
    required: ['station_id'],
    additionalProperties: false,
  };
  protected readonly args = args;

  protected async execute(
    { station_id }: z.infer<typeof args>,
    ctx: ToolContext,
  ): Promise<ReviewOutput> {
    this.assertStation(station_id, ctx);
    const [search, stats] = await Promise.all([
      ctx.provider.searchReviews(ctx.station.id, 'water', REVIEW_QUERY, REVIEW_LIMIT),
      ctx.provider.getReviewStats(ctx.station.id, 'water'),
    ]);

    const output: ReviewOutput = {
      station_id: ctx.station.id,
      count: stats.count,
      average_rating: stats.average === null ? null : Math.round(stats.average * 10) / 10,
      reviews: search.reviews.slice(0, REVIEW_LIMIT).map((review) => ({
        facility_name: review.facilityName,
        rating: review.rating,
        // Cleaned again here, so a provider bug can never pass a URL or a long text to the model.
        comment: reviewSnippet(review.comment, REVIEW_SNIPPET_MAX_CHARS),
        days_ago: daysBetween(review.createdAt, ctx.now),
      })),
    };
    ctx.evidence.outputs.reviews = output;
    return output;
  }
}

function daysBetween(isoDate: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(isoDate)) / DAY_MS));
}
