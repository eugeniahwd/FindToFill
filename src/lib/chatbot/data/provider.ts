/**
 * src/lib/chatbot/data/provider.ts
 *
 * The data seam between the chatbot and the database (docs/AI_TRACK.md §3.2). The Backend
 * implements it on its src/lib/data helpers; the chatbot module never imports Supabase.
 * tests/chatbot/provider.contract.ts checks any implementation against the rules below.
 */

import type { FacilityStatus, FacilityType } from '../contract';

/** A pilot station. Coordinates are for distance math only and never reach the model. */
export interface StationRef {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface FacilityRow {
  id: string;
  stationId: string;
  type: FacilityType;
  name: string;
  platform: string | null;
  locationDetail: string | null;
  level: string | null;
  latitude: number;
  longitude: number;
}

export interface FacilityStatusRow {
  facilityId: string;
  status: FacilityStatus;
  lastReportedAt: string | null; // ISO 8601
  activeReportCount: number;
}

export interface Departure {
  line: string;
  direction: string;
  minutesUntil: number;
}

export interface TimeCheck {
  neededMinutes: number;
  enoughTime: boolean;
  slackMinutes: number; // negative = not enough time
}

export interface NextTrains {
  dataAvailable: boolean;
  serviceEnded: boolean;
  departures: Departure[];
  timeCheck?: TimeCheck;
}

export interface ReviewSnippet {
  facilityId: string;
  facilityName: string;
  rating: number;
  comment: string; // cleaned: no URLs or control characters, at most 300 characters
  createdAt: string; // ISO 8601
}

export interface ReviewSearch {
  method: 'semantic' | 'latest';
  reviews: ReviewSnippet[];
}

export interface ReviewStats {
  count: number;
  average: number | null;
}

export interface ChatbotDataProvider {
  /** Pilot stations only (is_pilot). Client station ids are matched against this list. */
  listStations(): Promise<StationRef[]>;

  /** Active facilities of a station, of one type or "any". Empty text columns are null. */
  listFacilities(stationId: string, type: FacilityType | 'any'): Promise<FacilityRow[]>;

  /**
   * One row per active facility in `facilityIds`. Status is the most recent non-removed report
   * from the last 7 days; with none: "unknown", lastReportedAt null, activeReportCount 0.
   * Ids that are not active facilities are left out. No photo signing (latency).
   */
  getFacilityStatuses(facilityIds: string[]): Promise<FacilityStatusRow[]>;

  /**
   * Next trains as the Backend's getNextTrains() computes them: Asia/Jakarta clock, weekend
   * timetable on Saturday and Sunday, at most 2 per line and direction, soonest first.
   * dataAvailable is false when there is no timetable for today's day type (and `line`, if
   * given). serviceEnded is true when there is a timetable but no departure left today.
   * timeCheck (only with walkTimeMin > 0 and a departure): 2 x walk + 1 vs the soonest train.
   */
  getNextTrains(
    stationId: string,
    options: { line?: string; walkTimeMin?: number },
  ): Promise<NextTrains>;

  /**
   * Up to `limit` non-removed reviews of the station's active facilities of `type`, closest
   * to `query` (the Backend embeds it), or the latest ones when there is no query vector.
   */
  searchReviews(
    stationId: string,
    type: FacilityType,
    query: string,
    limit: number,
  ): Promise<ReviewSearch>;

  /** Count and average rating of non-removed reviews of the station's active `type` facilities. */
  getReviewStats(stationId: string, type: FacilityType): Promise<ReviewStats>;
}

// ─── Seed rows (database shape) ───────────────────────────────────────────────
// Used by FakeDataProvider and by the contract tests. A provider built from a seed must read
// exactly these rows and treat `now` as the current time (7-day window, next trains).

export interface SeedStation extends StationRef {
  isPilot: boolean;
}

export interface SeedFacility extends FacilityRow {
  isActive: boolean;
}

export interface SeedReport {
  facilityId: string;
  status: Exclude<FacilityStatus, 'unknown'>;
  createdAt: string; // ISO 8601
  removedAt: string | null;
}

export interface SeedSchedule {
  stationId: string;
  line: string;
  direction: string;
  dayType: 'weekday' | 'weekend';
  departureTime: string; // "HH:MM" or "HH:MM:SS", Asia/Jakarta local time
}

export interface SeedReview {
  facilityId: string;
  rating: number;
  comment: string; // raw user text
  createdAt: string; // ISO 8601
  removedAt: string | null;
}

export interface ProviderSeed {
  now: Date;
  stations: SeedStation[];
  facilities: SeedFacility[];
  reports: SeedReport[];
  schedules: SeedSchedule[];
  reviews: SeedReview[];
}
