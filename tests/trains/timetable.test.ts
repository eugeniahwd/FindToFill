import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv } from '@/lib/seed/csv';
import { TIMETABLE, type TimetableStop } from '@/lib/trains/timetable';

function find(train: string, station: string): TimetableStop | undefined {
  return TIMETABLE.stops.find((s) => s.train === train && s.station === station);
}

const hhmm = (minute: number) => {
  const m = minute % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

describe('TIMETABLE (generated from the KAI GAPEKA 2026 PDF)', () => {
  it('KA 1125 stops at Tebet 04:38 coming from Cawang 04:35', () => {
    expect(find('1125', 'Tebet')).toMatchObject({
      line: 'Bogor Line',
      direction: 'Manggarai/Jakarta Kota',
      days: ['weekday', 'weekend'],
      minute: 278,
      prev: { code: 'CW', name: 'Cawang', minute: 275 },
    });
  });

  it('KA 1149F is weekday only', () => {
    expect(find('1149F', 'Tebet')).toMatchObject({ minute: 340, days: ['weekday'] });
  });

  it('KA 1436 runs after midnight on the same service day', () => {
    expect(find('1436', 'Manggarai')).toMatchObject({
      minute: 1462,
      prev: { code: 'CKI', name: 'Cikini', minute: 1454 },
    });
    expect(find('1436', 'Tebet')).toMatchObject({ minute: 1465, prev: { code: 'MRI', minute: 1462 } });
  });

  it('KA 5701 at Sudirman comes from Manggarai 04:15 and does not board at Manggarai', () => {
    expect(find('5701', 'Sudirman')).toMatchObject({ minute: 259, prev: { code: 'MRI', minute: 255 } });
    expect(find('5701', 'Manggarai')).toBeUndefined();
  });

  it('trains starting at Manggarai have no prev', () => {
    expect(find('5703', 'Manggarai')).toMatchObject({ prev: null });
  });

  it('matches supabase/seed/schedules.csv row for row', () => {
    const csv = parseCsv(readFileSync(join(process.cwd(), 'supabase', 'seed', 'schedules.csv'), 'utf8'));
    const fromCsv = new Set(
      csv.map((r) => [r.station_name, r.line, r.direction, r.day_type, r.departure_time].join('|')),
    );
    const fromJson = TIMETABLE.stops.flatMap((s) =>
      s.days.map((d) => [s.station, s.line, s.direction, d, hhmm(s.minute)].join('|')),
    );
    expect(fromJson).toHaveLength(2407);
    expect(new Set(fromJson)).toEqual(fromCsv);
  });
});
