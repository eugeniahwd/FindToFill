import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { APP_CONFIG } from '@/lib/config';
import { fromDatabaseError } from '@/lib/api/errors';
import type { FacilityType } from '@/lib/chatbot/contract';
import type {
  ChatbotDataProvider,
  FacilityRow,
  FacilityStatusRow,
  NextTrains,
  ReviewSearch,
  ReviewStats,
  StationRef,
} from '@/lib/chatbot/data/provider';
import { getNextTrains } from './schedules';
import { searchStationReviews } from './reviews';

// The chatbot's view of the database (ChatbotDataProvider, docs/AI_TRACK.md §3.2), on the same
// tables and rules as the map and station pages, so both always show the same facts.
// Checked by tests/chatbot/provider.contract.ts (tests/chatbotSupabaseProvider.test.ts).
// Pass the request client (createSupabaseServerClient): every read is public data under RLS.
// It never receives the user's coordinates; the chatbot computes distances itself.

type Db = SupabaseClient<Database>;
/** Embeds a search query (Gemini), or null when embedding is unavailable. */
export type EmbedQuery = (text: string) => Promise<number[] | null>;

export interface SupabaseProviderOptions {
  /** Current time for the 7-day report window and next trains. Default: the real clock. */
  now?: () => Date;
  /** Default: no embedding, so review search falls back to the latest reviews. */
  embedQuery?: EmbedQuery;
}

const FACILITY_COLUMNS = 'id, station_id, type, name, platform, location_detail, level, latitude, longitude';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids come from the client or the model: anything that is not a UUID never reaches the database. */
const isUuid = (value: string) => UUID.test(value);
const textOrNull = (value: string | null) => (value && value.trim() !== '' ? value : null);
const NO_TRAINS: NextTrains = { dataAvailable: false, serviceEnded: false, departures: [] };

export class SupabaseDataProvider implements ChatbotDataProvider {
  private readonly now: () => Date;
  private readonly embedQuery: EmbedQuery;

  constructor(
    private readonly db: Db,
    options: SupabaseProviderOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.embedQuery = options.embedQuery ?? (async () => null);
  }

  async listStations(): Promise<StationRef[]> {
    const { data, error } = await this.db
      .from('stations')
      .select('id, name, latitude, longitude')
      .eq('is_pilot', true)
      .order('name');
    if (error) throw fromDatabaseError(error);
    return data.map((s) => ({ id: s.id, name: s.name, latitude: s.latitude, longitude: s.longitude }));
  }

  async listFacilities(stationId: string, type: FacilityType | 'any'): Promise<FacilityRow[]> {
    if (!isUuid(stationId)) return [];
    let query = this.db
      .from('facilities')
      .select(FACILITY_COLUMNS)
      .eq('station_id', stationId)
      .eq('is_active', true);
    if (type !== 'any') query = query.eq('type', type);
    const { data, error } = await query.order('name');
    if (error) throw fromDatabaseError(error);
    return data.map((f) => ({
      id: f.id,
      stationId: f.station_id,
      type: f.type,
      name: f.name,
      platform: textOrNull(f.platform),
      locationDetail: textOrNull(f.location_detail),
      level: textOrNull(f.level),
      latitude: f.latitude,
      longitude: f.longitude,
    }));
  }

  /**
   * Same rule as the facility_status view behind the map: the newest non-removed report of the
   * last 7 days wins. Read from reports here so the window follows `now` (the view uses the
   * database clock), and without photo paths (no signing on the chat path).
   */
  async getFacilityStatuses(facilityIds: string[]): Promise<FacilityStatusRow[]> {
    const ids = [...new Set(facilityIds.filter(isUuid))];
    if (ids.length === 0) return [];

    const { data: active, error: facilityError } = await this.db
      .from('facilities')
      .select('id')
      .in('id', ids)
      .eq('is_active', true);
    if (facilityError) throw fromDatabaseError(facilityError);
    if (active.length === 0) return [];

    const since = new Date(this.now().getTime() - APP_CONFIG.ACTIVE_REPORT_WINDOW_MS).toISOString();
    const { data: reports, error } = await this.db
      .from('reports')
      .select('facility_id, status, created_at')
      .in('facility_id', active.map((f) => f.id))
      .is('removed_at', null)
      .gt('created_at', since)
      .order('created_at', { ascending: false });
    if (error) throw fromDatabaseError(error);

    return active.map(({ id }) => {
      const recent = reports.filter((r) => r.facility_id === id);
      const latest = recent[0];
      return latest
        ? { facilityId: id, status: latest.status, lastReportedAt: latest.created_at, activeReportCount: recent.length }
        : { facilityId: id, status: 'unknown', lastReportedAt: null, activeReportCount: 0 };
    });
  }

  async getNextTrains(stationId: string, options: { line?: string; walkTimeMin?: number }): Promise<NextTrains> {
    if (!isUuid(stationId)) return NO_TRAINS;
    const trains = await getNextTrains(this.db, stationId, { ...options, now: this.now() });
    return {
      dataAvailable: trains.dataAvailable,
      serviceEnded: trains.serviceEnded,
      departures: trains.departures.map(({ line, direction, minutesUntil }) => ({ line, direction, minutesUntil })),
      ...(trains.timeCheck ? { timeCheck: trains.timeCheck } : {}),
    };
  }

  async searchReviews(stationId: string, type: FacilityType, query: string, limit: number): Promise<ReviewSearch> {
    if (!isUuid(stationId)) return { method: 'latest', reviews: [] };
    const facilities = await this.listFacilities(stationId, type);
    if (facilities.length === 0) return { method: 'latest', reviews: [] };

    const vector = query.trim() === '' ? null : await this.embedQuery(query);
    const result = await searchStationReviews(
      this.db,
      stationId,
      vector,
      limit,
      facilities.map(({ id, name }) => ({ id, name })),
    );
    return {
      method: result.method,
      reviews: result.reviews.map(({ facilityId, facilityName, rating, comment, createdAt }) => ({
        facilityId,
        facilityName,
        rating,
        comment,
        createdAt,
      })),
    };
  }

  async getReviewStats(stationId: string, type: FacilityType): Promise<ReviewStats> {
    if (!isUuid(stationId)) return { count: 0, average: null };
    const facilities = await this.listFacilities(stationId, type);
    if (facilities.length === 0) return { count: 0, average: null };

    const { data, error } = await this.db
      .from('reviews')
      .select('rating')
      .in('facility_id', facilities.map((f) => f.id))
      .is('removed_at', null);
    if (error) throw fromDatabaseError(error);
    const total = data.reduce((sum, r) => sum + r.rating, 0);
    return { count: data.length, average: data.length > 0 ? total / data.length : null };
  }
}
