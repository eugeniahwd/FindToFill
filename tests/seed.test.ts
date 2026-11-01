import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv } from '@/lib/seed/csv';
import {
  facilityCsvSchema,
  normalizeTime,
  parseRecords,
  scheduleCsvSchema,
  stationCsvSchema,
} from '@/lib/seed/rows';

const seedFile = (name: string) => readFileSync(join(process.cwd(), 'supabase', 'seed', name), 'utf8');

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas, CRLF, BOM, and blank lines', () => {
    const csv = '﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n1,\n';
    expect(parseCsv(csv)).toEqual([
      { a: 'x, y', b: 'say "hi"' },
      { a: '1', b: '' },
    ]);
  });

  it('rejects rows with the wrong column count', () => {
    expect(() => parseCsv('a,b\n1,2,3\n')).toThrow(/Line 2/);
  });

  it('rejects an unterminated quote', () => {
    expect(() => parseCsv('a\n"oops\n')).toThrow(/unterminated/);
  });
});

describe('seed row validation', () => {
  it('splits station lines on |', () => {
    const [row] = parseRecords(
      [{ name: 'X', lines: 'A | B', latitude: '-6.2', longitude: '106.8', is_pilot: 'true', is_demo_data: 'TRUE' }],
      stationCsvSchema,
      'stations.csv',
    );
    expect(row).toEqual({ name: 'X', lines: ['A', 'B'], latitude: -6.2, longitude: 106.8, is_pilot: true, is_demo_data: true });
  });

  it('rejects out-of-range layout percentages and reports the line number', () => {
    const record = {
      station_name: 'X', type: 'water', name: 'F', platform: '', location_detail: '', level: '',
      latitude: '-6.2', longitude: '106.8', layout_x: '120', layout_y: '', is_active: 'true', is_demo_data: 'true',
    };
    expect(() => parseRecords([record], facilityCsvSchema, 'facilities.csv')).toThrow(/facilities.csv line 2: layout_x/);
  });

  it('rejects empty coordinates instead of coercing them to 0', () => {
    const record = { name: 'X', lines: '', latitude: '', longitude: '106.8', is_pilot: 'true', is_demo_data: 'true' };
    expect(() => parseRecords([record], stationCsvSchema, 'stations.csv')).toThrow(/latitude/);
  });

  it('normalizes schedule times and rejects invalid ones', () => {
    expect(normalizeTime('05:10')).toBe('05:10:00');
    const bad = { station_name: 'X', line: 'L', direction: 'D', day_type: 'weekday', departure_time: '24:00' };
    expect(() => parseRecords([bad], scheduleCsvSchema, 'schedules.csv')).toThrow(/departure_time/);
  });
});

describe('committed seed files', () => {
  const stations = parseRecords(parseCsv(seedFile('stations.csv')), stationCsvSchema, 'stations.csv');
  const facilities = parseRecords(parseCsv(seedFile('facilities.csv')), facilityCsvSchema, 'facilities.csv');
  const schedules = parseRecords(parseCsv(seedFile('schedules.csv')), scheduleCsvSchema, 'schedules.csv');
  const stationNames = new Set(stations.map((s) => s.name));

  it('are valid and only reference known stations', () => {
    expect(stations.length).toBeGreaterThan(0);
    for (const f of [...facilities, ...schedules]) expect(stationNames.has(f.stationName)).toBe(true);
  });

  it('mark every placeholder row as demo data', () => {
    expect(stations.every((s) => s.is_demo_data)).toBe(true);
    expect(facilities.every((f) => f.row.is_demo_data)).toBe(true);
    expect(schedules.every((s) => s.row.direction.includes('(DEMO)'))).toBe(true);
  });

  it('place every facility within the station detection radius of its station', () => {
    const byName = new Map(stations.map((s) => [s.name, s]));
    for (const { stationName, row } of facilities) {
      const s = byName.get(stationName)!;
      // ~0.007 degrees is roughly 800 m at Jakarta's latitude.
      expect(Math.abs(row.latitude - s.latitude)).toBeLessThan(0.007);
      expect(Math.abs(row.longitude - s.longitude)).toBeLessThan(0.007);
    }
  });
});
