import { KRL_LINES } from '@/lib/map/krlLines';
import type { LatLngTuple } from '@/lib/map/polyline';
import { calculateHaversineDistance } from '@/lib/utils/geo';
import { formatClock, type ServiceClock } from './clock';
import { trainState } from './nextTrains';
import { segmentPath, type SegmentLineId } from './segments';
import { TIMETABLE, type TimetableStop, type TrainLine } from './timetable';

export interface MapTrain {
  key: string;
  position: LatLngTuple;
  color: string;
  /** "→ Manggarai/Jakarta Kota ±2 mnt" */
  label: string;
  detail: { train: string; relasi: string; arrival: string };
}

const LINE_IDS: Record<TrainLine, SegmentLineId> = { 'Bogor Line': 'bogor', 'Cikarang Line': 'cikarang' };
const STATION_CODES: Record<string, string> = { Manggarai: 'MRI', Tebet: 'TEB', Sudirman: 'SUD' };
const LINE_COLORS = new Map(KRL_LINES.map((l) => [l.name, l.color]));

/** The point at `fraction` of the path's length (clamped to 0..1). */
export function pointAlong(path: LatLngTuple[], fraction: number): LatLngTuple {
  const f = Math.min(1, Math.max(0, fraction));
  const lengths = path.slice(1).map((p, i) => calculateHaversineDistance(path[i][0], path[i][1], p[0], p[1]));
  let remaining = f * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i += 1) {
    if (remaining <= lengths[i] && lengths[i] > 0) {
      const t = remaining / lengths[i];
      const [a, b] = [path[i], path[i + 1]];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    remaining -= lengths[i];
  }
  return path[path.length - 1];
}

/** Trains running right now from the previous stop to `station`, placed on the track by schedule. */
export function mapTrains(
  station: string,
  clock: ServiceClock,
  stops: TimetableStop[] = TIMETABLE.stops,
): MapTrain[] {
  const stationCode = STATION_CODES[station];
  if (!stationCode) return [];

  return stops.flatMap((stop) => {
    if (stop.station !== station || !stop.days.includes(clock.dayType) || stop.prev === null) return [];
    if (clock.minute < stop.prev.minute || clock.minute >= stop.minute) return [];
    const path = segmentPath(LINE_IDS[stop.line], stop.prev.code, stationCode);
    if (!path) return [];

    const state = trainState(stop, clock.minute);
    return [
      {
        key: `${stop.train}|${stop.station}|${stop.minute}`,
        position: pointAlong(path, state.progress),
        color: LINE_COLORS.get(stop.line) ?? '#011638',
        label: `→ ${stop.direction} ±${state.minutesUntil} mnt`,
        detail: { train: stop.train, relasi: stop.relasi, arrival: formatClock(stop.minute) },
      },
    ];
  });
}
