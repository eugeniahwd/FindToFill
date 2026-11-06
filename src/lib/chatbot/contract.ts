/**
 * src/lib/chatbot/contract.ts
 *
 * HTTP contract for POST /api/chat, shared with the Frontend.
 * Copied exactly from docs/AI_TRACK.md §3.1. Keep it stable: any change needs a note to the team.
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
  lat?: number; // validated range, never stored
  lng?: number;
  stationId?: string; // manual station choice (GPS denied or wrong)
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
  distanceIsApproximate: boolean; // true when measured from the station center
  walkTimeMin: number;
  status: FacilityStatus;
  lastReportedAt: string | null; // ISO 8601
  minutesAgo: number | null;
}

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
