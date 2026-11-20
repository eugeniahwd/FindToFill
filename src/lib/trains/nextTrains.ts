import { formatClock, type ServiceClock } from './clock';
import { TIMETABLE, type TimetableStop, type TrainLine } from './timetable';

/** How long a train stays on the card as "Tiba sekarang" after its time. */
export const ARRIVING_WINDOW_MIN = 1;

export type TrainPhase = 'waiting' | 'moving' | 'arriving' | 'origin';

export interface TrainState {
  stop: TimetableStop;
  minutesUntil: number;
  /** 0 at the previous station, 1 at this station (also for trains that start here). */
  progress: number;
  phase: TrainPhase;
}

export interface DirectionSlide {
  key: string;
  line: TrainLine;
  lineCode: 'B' | 'C';
  direction: string;
  /** null when no train is left in this service day. */
  train: TrainState | null;
  /** First departure of the next service day, when train is null. */
  firstTrainTime: string | null;
}

const LINE_CODES: Record<TrainLine, 'B' | 'C'> = { 'Bogor Line': 'B', 'Cikarang Line': 'C' };
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function trainState(stop: TimetableStop, now: number): TrainState {
  const left = stop.minute - now;
  const minutesUntil = Math.max(0, Math.ceil(left));
  if (left <= 0) return { stop, minutesUntil, progress: 1, phase: 'arriving' };
  // Starts here: the train stands at this station until it leaves.
  if (stop.prev === null) return { stop, minutesUntil, progress: 1, phase: 'origin' };
  if (now < stop.prev.minute) return { stop, minutesUntil, progress: 0, phase: 'waiting' };
  const progress = clamp01((now - stop.prev.minute) / (stop.minute - stop.prev.minute));
  return { stop, minutesUntil, progress, phase: 'moving' };
}

export function directionSlides(
  station: string,
  clock: ServiceClock,
  stops: TimetableStop[] = TIMETABLE.stops,
): DirectionSlide[] {
  const groups = new Map<string, TimetableStop[]>();
  for (const s of stops) {
    if (s.station !== station) continue;
    const key = `${s.line}|${s.direction}`;
    const list = groups.get(key);
    if (list) list.push(s);
    else groups.set(key, [s]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => {
      const { line, direction } = list[0];
      const earliest = (candidates: TimetableStop[]) =>
        candidates.reduce<TimetableStop | null>((best, s) => (best === null || s.minute < best.minute ? s : best), null);

      const next = earliest(
        list.filter((s) => s.days.includes(clock.dayType) && s.minute >= clock.minute - ARRIVING_WINDOW_MIN),
      );
      const first = next ? null : earliest(list.filter((s) => s.days.includes(clock.nextDayType)));
      return {
        key,
        line,
        lineCode: LINE_CODES[line],
        direction,
        train: next ? trainState(next, clock.minute) : null,
        firstTrainTime: first ? formatClock(first.minute) : null,
      };
    });
}
