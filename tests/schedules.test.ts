/**
 * @jest-environment node
 */
import { getNextTrains, refillTimeCheck, stationClock, upcomingDepartures, type StationClock } from '@/lib/data/schedules';
import { fakeSupabase } from './helpers/fakeSupabase';

const STATION = '33333333-3333-4333-8333-333333333333';
const at = (hhmm: string, dayType: StationClock['dayType'] = 'weekday'): StationClock => {
  const [h, m] = hhmm.split(':').map(Number);
  return { dayType, minutes: h * 60 + m, label: hhmm };
};
const row = (direction: string, time: string, line = 'Bogor Line') => ({ line, direction, departure_time: `${time}:00` });

describe('stationClock (WIB)', () => {
  it('converts UTC to Jakarta time (UTC+7)', () => {
    expect(stationClock(new Date('2026-11-06T02:00:00Z'))).toEqual({ dayType: 'weekday', minutes: 9 * 60, label: '09:00' });
  });

  it('uses the weekend timetable on Saturday and Sunday in Jakarta, even when it is still Friday in UTC', () => {
    // Fri 22:30 UTC = Sat 05:30 WIB
    expect(stationClock(new Date('2026-11-06T22:30:00Z'))).toMatchObject({ dayType: 'weekend', label: '05:30' });
    expect(stationClock(new Date('2026-11-08T10:00:00Z'))).toMatchObject({ dayType: 'weekend' });
  });

  it('switches back to weekday after Sunday midnight WIB', () => {
    // Sun 17:30 UTC = Mon 00:30 WIB
    expect(stationClock(new Date('2026-11-08T17:30:00Z'))).toEqual({ dayType: 'weekday', minutes: 30, label: '00:30' });
  });
});

describe('upcomingDepartures', () => {
  const rows = [
    row('Jakarta Kota', '05:10'), row('Jakarta Kota', '05:20'), row('Jakarta Kota', '05:30'), row('Jakarta Kota', '05:40'),
    row('Bogor', '05:15'), row('Bogor', '05:25'), row('Bogor', '05:35'),
  ];

  it('returns the next 2 per line and direction, soonest first, skipping trains already gone', () => {
    expect(upcomingDepartures(rows, at('05:12'))).toEqual([
      { line: 'Bogor Line', direction: 'Bogor', departureTime: '05:15', minutesUntil: 3 },
      { line: 'Bogor Line', direction: 'Jakarta Kota', departureTime: '05:20', minutesUntil: 8 },
      { line: 'Bogor Line', direction: 'Bogor', departureTime: '05:25', minutesUntil: 13 },
      { line: 'Bogor Line', direction: 'Jakarta Kota', departureTime: '05:30', minutesUntil: 18 },
    ]);
  });

  it('counts a train leaving this minute', () => {
    expect(upcomingDepartures(rows, at('05:15'))[0]).toMatchObject({ departureTime: '05:15', minutesUntil: 0 });
  });

  it('is empty after the last train of the day', () => {
    expect(upcomingDepartures(rows, at('23:30'))).toEqual([]);
  });
});

describe('refillTimeCheck (2 x walk + 1 minute)', () => {
  it.each([
    [3, 8, { neededMinutes: 7, enoughTime: true, slackMinutes: 1 }],
    [3, 7, { neededMinutes: 7, enoughTime: true, slackMinutes: 0 }],
    [4, 8, { neededMinutes: 9, enoughTime: false, slackMinutes: -1 }],
  ])('walk %i min, train in %i min', (walk, until, expected) => {
    expect(refillTimeCheck(walk, until)).toEqual(expected);
  });
});

describe('getNextTrains', () => {
  // Thu 2026-11-05 05:12 WIB
  const now = new Date('2026-11-04T22:12:00Z');

  it('reads only this station and today’s day type, and adds a time check', async () => {
    const db = fakeSupabase({ 'schedules.select': () => ({ data: [row('Bogor', '05:15'), row('Bogor', '05:25')] }) });
    const result = await getNextTrains(db.client, STATION, { now, walkTimeMin: 1 });

    expect(db.calls[0].filters).toEqual([
      ['eq', 'station_id', STATION],
      ['eq', 'day_type', 'weekday'],
    ]);
    expect(result).toMatchObject({ dataAvailable: true, serviceEnded: false, dayType: 'weekday', localTime: '05:12' });
    expect(result.departures).toHaveLength(2);
    expect(result.timeCheck).toEqual({ neededMinutes: 3, enoughTime: true, slackMinutes: 0 });
  });

  it('filters by line when given', async () => {
    const db = fakeSupabase({ 'schedules.select': () => ({ data: [] }) });
    await getNextTrains(db.client, STATION, { now, line: 'Bogor Line' });
    expect(db.calls[0].filters).toContainEqual(['eq', 'line', 'Bogor Line']);
  });

  it('reports no data (never a guess) when the station has no timetable', async () => {
    const db = fakeSupabase({ 'schedules.select': () => ({ data: [] }) });
    const result = await getNextTrains(db.client, STATION, { now, walkTimeMin: 2 });
    expect(result).toMatchObject({ dataAvailable: false, serviceEnded: false, departures: [] });
    expect(result.timeCheck).toBeUndefined();
  });

  it('reports service ended when every train today has left', async () => {
    const db = fakeSupabase({ 'schedules.select': () => ({ data: [row('Bogor', '05:00')] }) });
    const result = await getNextTrains(db.client, STATION, { now, walkTimeMin: 2 });
    expect(result).toMatchObject({ dataAvailable: true, serviceEnded: true, departures: [] });
    expect(result.timeCheck).toBeUndefined();
  });

  it('ignores an invalid walk time', async () => {
    const db = fakeSupabase({ 'schedules.select': () => ({ data: [row('Bogor', '05:15')] }) });
    expect((await getNextTrains(db.client, STATION, { now, walkTimeMin: -1 })).timeCheck).toBeUndefined();
  });
});
