/**
 * src/lib/chatbot/contract.ts
 *
 * HTTP contract for POST /api/chat, shared with the Frontend (docs/AI_TRACK.md §3.1, with the
 * GPS position from docs/AI_CHATBOT.md). Keep it stable: any change needs a note to the team.
 */

export const QUICK_MESSAGE_IDS = [
  'nearest_water',
  'nearest_charging',
  'facility_working',
  'time_to_refill',
  'review_summary',
] as const;
export type QuickMessageId = (typeof QUICK_MESSAGE_IDS)[number];
export type FacilityType = 'water' | 'charging';
export type FacilityStatus = 'available' | 'empty' | 'broken' | 'under_maintenance' | 'unknown';

export interface ChatRequest {
  quickMessageId: QuickMessageId;
  // The browser's GPS position, always both or neither. Used for this request only: resolved to
  // the nearest pilot station and to distances, never stored, logged, or shown to the model.
  lat?: number;
  lng?: number;
  // The station the user picked (or the one the app shows). It wins over GPS for which station;
  // GPS still gives the distances when the user is within the detection radius of it.
  stationId?: string;
  sessionId?: string; // anonymous random id from the client (optional)
}

export interface ChatCard {
  facilityId: string;
  name: string;
  type: FacilityType;
  platform: string | null;
  locationDetail: string | null;
  level: string | null;
  distanceM: number;
  // false: measured from the user's GPS position. true: from the station center (no GPS, or
  // the user is not at the station).
  distanceIsApproximate: boolean;
  walkTimeMin: number;
  status: FacilityStatus;
  lastReportedAt: string | null; // ISO 8601
  minutesAgo: number | null;
}

// source "gps": the GPS position is within the detection radius of the station. "manual": the
// station came from stationId alone. needsConfirmation: GPS is within the radius of more than
// one pilot station, so the app should let the user confirm (docs/SPEC.md §4.2).
export interface DetectedStation {
  id: string;
  name: string;
  source: 'gps' | 'manual';
  needsConfirmation: boolean;
}
export type ChatOutcome = 'answered' | 'fallback_no_data' | 'fallback_ai_unavailable' | 'rejected';

export interface ChatResponse {
  outcome: ChatOutcome;
  message: string; // Indonesian, at most 400 characters
  cards: ChatCard[]; // at most 3, built by the server from data rows
  scheduleReminder: boolean; // true when the train schedule was involved
  needsStationSelection: boolean; // true when the user must pick a station manually
  detectedStation: DetectedStation | null;
  generatedAt: string;
  retryAfterSec?: number; // only when rate limited
}
