import { z } from 'zod';
import { APP_CONFIG } from '@/lib/config';
import { cleanText } from './sanitize';

// Body of POST /api/reviews. One review per user per facility: posting again edits it.

export const reviewInputSchema = z
  .object({
    facilityId: z.uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z
      .string()
      .transform(cleanText)
      .pipe(
        z
          .string()
          .min(1, 'Please write a comment.')
          .max(APP_CONFIG.REVIEW_COMMENT_MAX_CHARS),
      ),
  })
  .strict();

export type ReviewInput = z.infer<typeof reviewInputSchema>;
