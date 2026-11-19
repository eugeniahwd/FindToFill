import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TableRow } from '@/lib/supabase/database.types';
import type { Schedule } from '@/lib/types';
import type { ScheduleCreateInput } from '@/lib/api/adminSchemas';
import { APP_CONFIG } from '@/lib/config';
import { ApiError, fromDatabaseError } from '@/lib/api/errors';

// Next departures for the get_next_train chatbot tool (docs/AI_CHATBOT.md, tool 4).
// Times are station-local (WIB). No cron and no stored "current" state: computed per request.

type Db = SupabaseClient<Database>;
type DayType = TableRow<'schedules'>['day_type'];
type ScheduleRow = Pick<TableRow<'schedules'>, 'line' | 'direction' | 'departure_time'>;

export interface StationClock {
  dayType: DayType;
  /** Minutes since local midnight. */
  minutes: number;
  /** Local time as HH:MM. */
  label: string;
}

export interface Departure {
  line: string;
  direction: string;
  /** Local departure time as HH:MM. */
  departureTime: string;
  minutesUntil: number;
}

export interface TimeCheck {
  /** 2 x walk time + refill time. */
  neededMinutes: number;
  enoughTime: boolean;
  /** minutesUntil of the next train minus neededMinutes (negative = not enough). */
  slackMinutes: number;
}

export interface NextTrains {
  /** false when the station has no timetable for today's day type (the bot must not guess). */
  dataAvailable: boolean;
  /** true when there is a timetable but no departure is left today. */
  serviceEnded: boolean;
  dayType: DayType;
  localTime: string;
  departures: Departure[];
  timeCheck?: TimeCheck;
}

/** Station-local clock for `now` (Asia/Jakarta, no DST). Saturday and Sunday use the weekend timetable. */
export function stationClock(now: Date): StationClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CONFIG.TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const hour = Number(part('hour'));
  const minute = Number(part('minute'));
  return {
    dayType: ['Sat', 'Sun'].includes(part('weekday')) ? 'weekend' : 'weekday',
    minutes: hour * 60 + minute,
    label: `${part('hour')}:${part('minute')}`,
  };
}

/** "05:10:00" (Postgres time) or "05:10" -> minutes since midnight. */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Departures still ahead today, the next `perDirection` for each line and direction,
 * soonest first. A train leaving this minute counts (minutesUntil 0).
 */
export function upcomingDepartures(
  rows: ScheduleRow[],
  clock: StationClock,
  perDirection: number = APP_CONFIG.NEXT_TRAINS_PER_DIRECTION,
): Departure[] {
  const ahead = rows
    .map((row) => ({
      line: row.line,
      direction: row.direction,
      departureTime: row.departure_time.slice(0, 5),
      minutesUntil: toMinutes(row.departure_time) - clock.minutes,
    }))
    .filter((d) => d.minutesUntil >= 0)
    .sort((a, b) => a.minutesUntil - b.minutesUntil);

  const taken = new Map<string, number>();
  return ahead.filter((d) => {
    const key = `${d.line}\u0000${d.direction}`;
    const count = taken.get(key) ?? 0;
    taken.set(key, count + 1);
    return count < perDirection;
  });
}

/** SPEC default 3: enough time when 2 x walk + refill minutes <= minutes until the train. */
export function refillTimeCheck(walkTimeMin: number, minutesUntil: number): TimeCheck {
  const neededMinutes = 2 * walkTimeMin + APP_CONFIG.REFILL_MINUTES;
  return { neededMinutes, enoughTime: neededMinutes <= minutesUntil, slackMinutes: minutesUntil - neededMinutes };
}

// ---------------------------------------------------------------------------
// Admin timetable editing (Stations tab): one departure at a time. Bulk changes use
// supabase/seed/schedules.csv + npm run db:seed. RLS allows writes for admins only.
// ---------------------------------------------------------------------------

function toSchedule(row: TableRow<'schedules'>): Schedule {
  return {
    id: row.id,
    stationId: row.station_id,
    line: row.line,
    direction: row.direction,
    dayType: row.day_type,
    departureTime: row.departure_time.slice(0, 5),
  };
}

/** A station's departures ordered by day type, line, direction, time. */
export async function listStationSchedules(db: Db, stationId: string, dayType?: DayType): Promise<Schedule[]> {
  let query = db.from('schedules').select('*').eq('station_id', stationId);
  if (dayType) query = query.eq('day_type', dayType);
  const { data, error } = await query
    .order('day_type')
    .order('line')
    .order('direction')
    .order('departure_time');
  if (error) throw fromDatabaseError(error);
  return data.map(toSchedule);
}

export async function addSchedule(db: Db, stationId: string, input: ScheduleCreateInput): Promise<Schedule> {
  const { data, error } = await db
    .from('schedules')
    .insert({
      station_id: stationId,
      line: input.line,
      direction: input.direction,
      day_type: input.dayType,
      departure_time: input.departureTime,
    })
    .select('*')
    .single();
  if (error) throw fromDatabaseError(error);
  return toSchedule(data);
}

export async function deleteSchedule(db: Db, scheduleId: string): Promise<void> {
  const { data, error } = await db.from('schedules').delete().eq('id', scheduleId).select('id');
  if (error) throw fromDatabaseError(error);
  if (data.length === 0) throw new ApiError(404, 'NOT_FOUND', 'Departure not found.');
}

/**
 * Next trains at a station for the current local day type. `walkTimeMin` (from
 * get_nearest_facility) adds a time check against the soonest departure.
 */
export async function getNextTrains(
  db: Db,
  stationId: string,
  options: { line?: string; walkTimeMin?: number; now?: Date } = {},
): Promise<NextTrains> {
  const clock = stationClock(options.now ?? new Date());

  let query = db
    .from('schedules')
    .select('line, direction, departure_time')
    .eq('station_id', stationId)
    .eq('day_type', clock.dayType);
  if (options.line) query = query.eq('line', options.line);
  const { data, error } = await query.order('departure_time');
  if (error) throw fromDatabaseError(error);

  const departures = upcomingDepartures(data, clock);
  const result: NextTrains = {
    dataAvailable: data.length > 0,
    serviceEnded: data.length > 0 && departures.length === 0,
    dayType: clock.dayType,
    localTime: clock.label,
    departures,
  };

  const walk = options.walkTimeMin;
  if (walk !== undefined && Number.isFinite(walk) && walk > 0 && departures.length > 0) {
    result.timeCheck = refillTimeCheck(walk, departures[0].minutesUntil);
  }
  return result;
}
