/**
 * src/lib/chatbot/validation.ts
 *
 * Request validation for POST /api/chat (docs/AI_TRACK.md §9 step 1). Rejected: unknown ids,
 * extra fields (such as free text), and coordinates that are out of range or sent alone.
 */

import { z } from 'zod';
import { QUICK_MESSAGE_IDS } from './contract';

// Supabase station ids are UUIDs and demo ids are slugs; both match.
const STATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const ChatRequestSchema = z
  .object({
    quickMessageId: z.enum(QUICK_MESSAGE_IDS),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    stationId: z.string().regex(STATION_ID_PATTERN).optional(),
    // Chat logs will store the session id, so only a random UUID is accepted, never personal data.
    sessionId: z.string().uuid().optional(),
  })
  .strict()
  // lat and lng come together; each rule names the missing field so the route can log its path.
  .refine((body) => body.lat === undefined || body.lng !== undefined, {
    path: ['lng'],
    message: 'lng is required when lat is sent',
  })
  .refine((body) => body.lng === undefined || body.lat !== undefined, {
    path: ['lat'],
    message: 'lat is required when lng is sent',
  });
