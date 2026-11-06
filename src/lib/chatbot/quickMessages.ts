/**
 * src/lib/chatbot/quickMessages.ts
 *
 * Allowlisted quick messages (docs/AI_TRACK.md §6): fixed Indonesian text and allowed tools per id.
 * The server never uses client text, and an unknown id is rejected.
 */

import { QUICK_MESSAGE_IDS, type QuickMessageId } from './contract';

export type ChatbotToolName =
  | 'get_user_location'
  | 'get_nearest_facility'
  | 'get_facility_status'
  | 'get_next_train'
  | 'search_reviews';

export interface QuickMessageDefinition {
  id: QuickMessageId;
  text: string;
  allowedTools: readonly ChatbotToolName[];
}

export const QUICK_MESSAGES: Readonly<Record<QuickMessageId, QuickMessageDefinition>> = {
  nearest_water: {
    id: 'nearest_water',
    text: 'Carikan stasiun dengan dispenser terdekat dari lokasiku sekarang',
    allowedTools: ['get_user_location', 'get_nearest_facility', 'get_facility_status'],
  },
  nearest_charging: {
    id: 'nearest_charging',
    text: 'Cari charging station terdekat dari lokasiku sekarang',
    allowedTools: ['get_user_location', 'get_nearest_facility', 'get_facility_status'],
  },
  facility_working: {
    id: 'facility_working',
    text: 'Apakah fasilitas di stasiun ini masih berfungsi?',
    allowedTools: ['get_user_location', 'get_nearest_facility', 'get_facility_status'],
  },
  time_to_refill: {
    id: 'time_to_refill',
    text: 'Sempat isi air sebelum kereta berikutnya datang?',
    allowedTools: [
      'get_user_location',
      'get_nearest_facility',
      'get_facility_status',
      'get_next_train',
    ],
  },
  review_summary: {
    id: 'review_summary',
    text: 'Rangkum ulasan air di stasiun ini',
    allowedTools: ['get_user_location', 'search_reviews'],
  },
};

// Checks the allowlist itself: `id in QUICK_MESSAGES` would also accept "constructor" or "__proto__".
export function isQuickMessageId(id: string): id is QuickMessageId {
  return (QUICK_MESSAGE_IDS as readonly string[]).includes(id);
}

export function getQuickMessage(id: string): QuickMessageDefinition | null {
  return isQuickMessageId(id) ? QUICK_MESSAGES[id] : null;
}
