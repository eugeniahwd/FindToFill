import { z } from 'zod';
import { APP_CONFIG } from '@/lib/config';

// Query strings of GET /api/admin/reports and /api/admin/reviews.
// strict(): unknown parameters are rejected, so typos do not silently return everything.

const limit = z.coerce.number().int().min(1).max(APP_CONFIG.MODERATION_LIST_MAX).optional();

export const reportModerationQuerySchema = z
  .object({
    stationId: z.uuid().optional(),
    status: z.enum(['available', 'empty', 'broken', 'under_maintenance']).optional(),
    limit,
  })
  .strict();

export const reviewModerationQuerySchema = z
  .object({
    stationId: z.uuid().optional(),
    limit,
  })
  .strict();
