import { formatClock, serviceClock, type ServiceClock } from '@/lib/trains/clock';
import { directionSlides } from '@/lib/trains/nextTrains';
import type { TimetableStop } from '@/lib/trains/timetable';

const weekday = (minute: number): ServiceClock => ({ dayType: 'weekday', nextDayType: 'weekday', minute });

const stop = (overrides: Partial<TimetableStop>): TimetableStop => ({
  train: '9001',
  relasi: 'Dp - Jakk',
  station: 'Tebet',
  line: 'Bogor Line',
  direction: 'Manggarai/Jakarta Kota',
  days: ['weekday', 'weekend'],
  minute: 278,
  prev: { code: 'CW', name: 'Cawang', minute: 275 },
  ...overrides,
});

const slide = (station: string, clock: ServiceClock, key: string, stops?: TimetableStop[]) =>
  directionSlides(station, clock, stops).find((s) => s.key === key);

describe('serviceClock', () => {
  it('reads a weekday morning in WIB, seconds included', () => {
    // Thursday 2026-12-03 06:38:30 WIB
    expect(serviceClock(new Date('2026-12-02T23:38:30Z'))).toEqual({
      dayType: 'weekday',
      nextDayType: 'weekday',
      minute: 398.5,
    });
  });

  it('saturday 00:10 uses friday', () => {
    // Saturday 2026-12-05 00:10 WIB still belongs to Friday's service day
    expect(serviceClock(new Date('2026-12-04T17:10:00Z'))).toEqual({
      dayType: 'weekday',
      nextDayType: 'weekend',
      minute: 1450,
    });
  });

  it('sunday service day is followed by a weekday', () => {
    // Sunday 2026-12-06 12:00 WIB
    expect(serviceClock(new Date('2026-12-06T05:00:00Z'))).toMatchObject({ dayType: 'weekend', nextDayType: 'weekday' });
  });
});

describe('formatClock', () => {
  it('prints HH.MM and wraps past midnight', () => {
    expect(formatClock(278)).toBe('04.38');
    expect(formatClock(1462)).toBe('00.22');
  });
});

describe('directionSlides', () => {
  it('has one slide per direction, sorted by line then direction', () => {
    expect(directionSlides('Tebet', weekday(600)).map((s) => s.key)).toEqual([
      'Bogor Line|Bogor/Depok/Nambo',
      'Bogor Line|Manggarai/Jakarta Kota',
    ]);
    expect(directionSlides('Manggarai', weekday(600))).toHaveLength(4);
    expect(directionSlides('Sudirman', weekday(600))).toHaveLength(2);
    expect(directionSlides('Juanda', weekday(600))).toEqual([]);
  });

  it('moving between Cawang and Tebet', () => {
    const s = slide('Tebet', weekday(276.5), 'Bogor Line|Manggarai/Jakarta Kota');
    expect(s?.lineCode).toBe('B');
    expect(s?.train).toMatchObject({ phase: 'moving', progress: 0.5, minutesUntil: 2 });
    expect(s?.train?.stop.train).toBe('1125');
  });

  it('waiting at the previous station', () => {
    const s = slide('Tebet', weekday(274), 'Bogor Line|Manggarai/Jakarta Kota', [stop({})]);
    expect(s?.train).toMatchObject({ phase: 'waiting', progress: 0, minutesUntil: 4 });
  });

  it('arriving for about a minute, then the next train', () => {
    const now = slide('Tebet', weekday(278.5), 'Bogor Line|Manggarai/Jakarta Kota');
    expect(now?.train).toMatchObject({ phase: 'arriving', progress: 1, minutesUntil: 0 });
    expect(now?.train?.stop.train).toBe('1125');
    const later = slide('Tebet', weekday(279.5), 'Bogor Line|Manggarai/Jakarta Kota');
    expect(later?.train?.stop.train).toBe('1127');
  });

  it('origin train has no moving icon', () => {
    const s = slide('Tebet', weekday(270), 'Bogor Line|Manggarai/Jakarta Kota', [stop({ prev: null })]);
    expect(s?.train).toMatchObject({ phase: 'origin', progress: 0 });
  });

  it('weekday-only trains are skipped on weekends', () => {
    const stops = [stop({ train: 'F1', days: ['weekday'], minute: 300 }), stop({ train: 'A1', minute: 310 })];
    const s = slide('Tebet', { dayType: 'weekend', nextDayType: 'weekend', minute: 290 }, 'Bogor Line|Manggarai/Jakarta Kota', stops);
    expect(s?.train?.stop.train).toBe('A1');
  });

  it('after midnight', () => {
    // 23:50: KA 1430 leaves Manggarai right now.
    const at2350 = slide('Manggarai', weekday(1430), 'Bogor Line|Bogor/Depok/Nambo');
    expect(at2350?.train).toMatchObject({ phase: 'arriving', stop: { train: '1430' } });
    // 23:52: next is KA 1432 at 00.03, still waiting at Cikini (23.58).
    const s = slide('Manggarai', weekday(1432), 'Bogor Line|Bogor/Depok/Nambo');
    expect(s?.train?.stop).toMatchObject({ train: '1432', minute: 1443, prev: { code: 'CKI', minute: 1438 } });
    expect(s?.train).toMatchObject({ phase: 'waiting', minutesUntil: 11 });
  });

  it('service ended shows the first train of the next service day', () => {
    const slides = directionSlides('Tebet', weekday(1600));
    expect(slides.every((s) => s.train === null)).toBe(true);
    const north = slides.find((s) => s.key === 'Bogor Line|Manggarai/Jakarta Kota');
    expect(north?.firstTrainTime).toBe('04.38');
  });
});
