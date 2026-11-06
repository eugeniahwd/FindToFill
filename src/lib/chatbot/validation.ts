/**
 * src/lib/chatbot/validation.ts
 *
 * Request validation for POST /api/chat (docs/AI_TRACK.md §9 step 1). Rejected: unknown ids and
 * any extra field, such as free text or lat/lng (GPS never reaches the server).
 */

import { z } from 'zod';
import { QUICK_MESSAGE_IDS } from './contract';

// Supabase station ids are UUIDs and demo ids are slugs; both match.
const STATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const ChatRequestSchema = z
  .object({
    quickMessageId: z.enum(QUICK_MESSAGE_IDS),
    stationId: z.string().regex(STATION_ID_PATTERN).optional(),
    // Chat logs will store the session id, so only a random UUID is accepted, never personal data.
    sessionId: z.string().uuid().optional(),
  })
  .strict();
