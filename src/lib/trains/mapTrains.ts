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
  /** Direction of travel along the track, degrees clockwise from north. */
  heading: number;
  color: string;
  /** "→ Manggarai/Jakarta Kota ±2 mnt" */
  label: string;
  detail: { train: string; relasi: string; arrival: string };
}

const LINE_IDS: Record<TrainLine, SegmentLineId> = { 'Bogor Line': 'bogor', 'Cikarang Line': 'cikarang' };
const STATION_CODES: Record<string, string> = { Manggarai: 'MRI', Tebet: 'TEB', Sudirman: 'SUD' };
const LINE_COLORS = new Map(KRL_LINES.map((l) => [l.name, l.color]));

/** The piece of track (index of its first point) at `fraction` of the path's length, and how far along it. */
function locate(path: LatLngTuple[], fraction: number): { i: number; t: number } | null {
  const f = Math.min(1, Math.max(0, fraction));
  const lengths = path.slice(1).map((p, i) => calculateHaversineDistance(path[i][0], path[i][1], p[0], p[1]));
  let remaining = f * lengths.reduce((a, b) => a + b, 0);
  let last: { i: number; t: number } | null = null;
  for (let i = 0; i < lengths.length; i += 1) {
    if (lengths[i] === 0) continue;
    if (remaining <= lengths[i]) return { i, t: remaining / lengths[i] };
    remaining -= lengths[i];
    last = { i, t: 1 };
  }
  return last;
}

/** The point at `fraction` of the path's length (clamped to 0..1). */
export function pointAlong(path: LatLngTuple[], fraction: number): LatLngTuple {
  const at = locate(path, fraction);
  if (!at) return path[path.length - 1];
  const [a, b] = [path[at.i], path[at.i + 1]];
  return [a[0] + (b[0] - a[0]) * at.t, a[1] + (b[1] - a[1]) * at.t];
}

/** Direction of travel at `fraction` of the path, in degrees clockwise from north (0..360). */
export function headingAlong(path: LatLngTuple[], fraction: number): number {
  const at = locate(path, fraction);
  if (!at) return 0;
  const [a, b] = [path[at.i], path[at.i + 1]];
  // Scale longitude by cos(latitude) so the angle matches what the map shows.
  const dx = (b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180);
  const dy = b[0] - a[0];
  const degrees = (Math.atan2(dx, dy) * 180) / Math.PI;
  return (degrees + 360) % 360;
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
        heading: headingAlong(path, state.progress),
        color: LINE_COLORS.get(stop.line) ?? '#011638',
        label: `→ ${stop.direction} ±${state.minutesUntil} mnt`,
        detail: { train: stop.train, relasi: stop.relasi, arrival: formatClock(stop.minute) },
      },
    ];
  });
}
