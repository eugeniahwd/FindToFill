/**
 * src/lib/chatbot/data/fakeProvider.ts
 *
 * In-memory ChatbotDataProvider over seed rows (docs/AI_TRACK.md §12), so the chatbot runs and
 * is tested without Supabase. It follows the same rules as the Backend implementation, and
 * tests/chatbot/provider.contract.ts holds both to them.
 */

import { reviewSnippet } from '../../api/sanitize';
import {
  FILL_BUFFER_MIN,
  NEXT_TRAINS_PER_DIRECTION,
  REPORT_WINDOW_DAYS,
  REVIEW_SNIPPET_MAX_CHARS,
  TIMEZONE,
} from '../config';
import type { FacilityType } from '../contract';
import type {
  ChatbotDataProvider,
  Departure,
  FacilityRow,
  FacilityStatusRow,
  NextTrains,
  ProviderSeed,
  ReviewSearch,
  ReviewSnippet,
  ReviewStats,
  SeedFacility,
  SeedReview,
  SeedSchedule,
  StationRef,
} from './provider';

const REPORT_WINDOW_MS = REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
// Letters or digits in any script, 3 or more in a row. Built at runtime: the ES2017 target
// does not allow Unicode property escapes in regex literals.
const WORD = new RegExp('[\\p{L}\\p{N}]{3,}', 'gu');

export class FakeDataProvider implements ChatbotDataProvider {
  constructor(private readonly seed: ProviderSeed) {}

  async listStations(): Promise<StationRef[]> {
    return this.seed.stations
      .filter((station) => station.isPilot)
      .map(({ id, name, latitude, longitude }) => ({ id, name, latitude, longitude }));
  }

  async listFacilities(stationId: string, type: FacilityType | 'any'): Promise<FacilityRow[]> {
    return this.activeFacilities(stationId)
      .filter((facility) => type === 'any' || facility.type === type)
      .map(toFacilityRow);
  }

  async getFacilityStatuses(facilityIds: string[]): Promise<FacilityStatusRow[]> {
    const active = new Set(this.seed.facilities.filter((f) => f.isActive).map((f) => f.id));
    return [...new Set(facilityIds)].filter((id) => active.has(id)).map((id) => this.statusOf(id));
  }

  async getNextTrains(
    stationId: string,
    { line, walkTimeMin }: { line?: string; walkTimeMin?: number },
  ): Promise<NextTrains> {
    const clock = stationClock(this.seed.now);
    const rows = this.seed.schedules.filter(
      (row) =>
        row.stationId === stationId &&
        row.dayType === clock.dayType &&
        (!line || row.line === line),
    );
    const departures = upcomingDepartures(rows, clock.minutes);
    const result: NextTrains = {
      dataAvailable: rows.length > 0,
      serviceEnded: rows.length > 0 && departures.length === 0,
      departures,
    };

    const soonest = departures[0];
    if (walkTimeMin !== undefined && Number.isFinite(walkTimeMin) && walkTimeMin > 0 && soonest) {
      const neededMinutes = 2 * walkTimeMin + FILL_BUFFER_MIN;
      result.timeCheck = {
        neededMinutes,
        enoughTime: neededMinutes <= soonest.minutesUntil,
        slackMinutes: soonest.minutesUntil - neededMinutes,
      };
    }
    return result;
  }

  // Stands in for the semantic search: more query words in the comment ranks higher, then newer.
  async searchReviews(
    stationId: string,
    type: FacilityType,
    query: string,
    limit: number,
  ): Promise<ReviewSearch> {
    const queryWords = words(query);
    const reviews = this.reviewsOf(stationId, type)
      .map((review) => ({ review, score: overlap(queryWords, review.comment) }))
      .sort((a, b) => b.score - a.score || newestFirst(a.review, b.review))
      .slice(0, Math.max(0, limit))
      .map(({ review }) => this.toSnippet(review));
    return { method: queryWords.size > 0 ? 'semantic' : 'latest', reviews };
  }

  async getReviewStats(stationId: string, type: FacilityType): Promise<ReviewStats> {
    const ratings = this.reviewsOf(stationId, type).map((review) => review.rating);
    const total = ratings.reduce((sum, rating) => sum + rating, 0);
    return { count: ratings.length, average: ratings.length > 0 ? total / ratings.length : null };
  }

  private activeFacilities(stationId: string): SeedFacility[] {
    return this.seed.facilities.filter((f) => f.stationId === stationId && f.isActive);
  }

  private statusOf(facilityId: string): FacilityStatusRow {
    const since = this.seed.now.getTime() - REPORT_WINDOW_MS;
    const recent = this.seed.reports
      .filter(
        (r) =>
          r.facilityId === facilityId && r.removedAt === null && Date.parse(r.createdAt) > since,
      )
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const latest = recent[0];
    if (!latest) {
      return { facilityId, status: 'unknown', lastReportedAt: null, activeReportCount: 0 };
    }
    return {
      facilityId,
      status: latest.status,
      lastReportedAt: latest.createdAt,
      activeReportCount: recent.length,
    };
  }

  private reviewsOf(stationId: string, type: FacilityType): SeedReview[] {
    const ids = new Set(
      this.activeFacilities(stationId)
        .filter((f) => f.type === type)
        .map((f) => f.id),
    );
    return this.seed.reviews.filter((r) => ids.has(r.facilityId) && r.removedAt === null);
  }

  private toSnippet(review: SeedReview): ReviewSnippet {
    const facility = this.seed.facilities.find((f) => f.id === review.facilityId);
    return {
      facilityId: review.facilityId,
      facilityName: facility?.name ?? '',
      rating: review.rating,
      comment: reviewSnippet(review.comment, REVIEW_SNIPPET_MAX_CHARS),
      createdAt: review.createdAt,
    };
  }
}

function toFacilityRow(facility: SeedFacility): FacilityRow {
  return {
    id: facility.id,
    stationId: facility.stationId,
    type: facility.type,
    name: facility.name,
    platform: facility.platform ?? null,
    locationDetail: facility.locationDetail ?? null,
    level: facility.level ?? null,
    latitude: facility.latitude,
    longitude: facility.longitude,
  };
}

/** Station-local clock (Asia/Jakarta, no DST), like stationClock() in src/lib/data/schedules.ts. */
function stationClock(now: Date): { dayType: SeedSchedule['dayType']; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return {
    dayType: ['Sat', 'Sun'].includes(part('weekday') ?? '') ? 'weekend' : 'weekday',
    minutes: Number(part('hour')) * 60 + Number(part('minute')),
  };
}

/** Departures still ahead today, at most NEXT_TRAINS_PER_DIRECTION per line and direction. */
function upcomingDepartures(rows: SeedSchedule[], nowMinutes: number): Departure[] {
  const ahead = rows
    .map((row) => ({
      line: row.line,
      direction: row.direction,
      minutesUntil: toMinutes(row.departureTime) - nowMinutes,
    }))
    .filter((departure) => departure.minutesUntil >= 0)
    .sort((a, b) => a.minutesUntil - b.minutesUntil);

  const taken = new Map<string, number>();
  return ahead.filter((departure) => {
    const key = `${departure.line}\u0000${departure.direction}`;
    const count = taken.get(key) ?? 0;
    taken.set(key, count + 1);
    return count < NEXT_TRAINS_PER_DIRECTION;
  });
}

/** "05:10" or "05:10:00" -> minutes since midnight. */
function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().match(WORD) ?? []);
}

function newestFirst(a: { createdAt: string }, b: { createdAt: string }): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

function overlap(queryWords: Set<string>, comment: string): number {
  return [...words(comment)].filter((word) => queryWords.has(word)).length;
}
