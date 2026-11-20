import { APP_CONFIG } from '@/lib/config';
import type { DayType } from './timetable';

/** A service day runs from 03:00 to 03:00 WIB, so trains after midnight stay on the evening's timetable. */
export const SERVICE_DAY_START_MIN = 180;

export interface ServiceClock {
  /** Timetable of the current service day (Saturday/Sunday = weekend; holidays count as weekdays). */
  dayType: DayType;
  /** Timetable of the following service day, for "kereta pertama" once service is over. */
  nextDayType: DayType;
  /** Minutes since 00:00 of the service day, with seconds as a fraction; after midnight > 1440. */
  minute: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayTypeOf = (weekdayIndex: number): DayType =>
  weekdayIndex === 0 || weekdayIndex === 6 ? 'weekend' : 'weekday';

export function serviceClock(now: Date): ServiceClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CONFIG.TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';

  let weekday = WEEKDAYS.indexOf(part('weekday'));
  let minute = Number(part('hour')) * 60 + Number(part('minute')) + Number(part('second')) / 60;
  if (minute < SERVICE_DAY_START_MIN) {
    weekday = (weekday + 6) % 7;
    minute += 1440;
  }
  return { dayType: dayTypeOf(weekday), nextDayType: dayTypeOf((weekday + 1) % 7), minute };
}

/** 278 -> "04.38", 1462 -> "00.22" (KAI timetable style). */
export function formatClock(minute: number): string {
  const m = Math.floor(minute) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}.${String(m % 60).padStart(2, '0')}`;
}
