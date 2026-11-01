import { z } from 'zod';
import type { TableInsert } from '../supabase/database.types';
import type { CsvRecord } from './csv';

// Relative imports only: this module is also loaded by scripts/seed.ts through ts-node.

const text = z.string().trim().min(1);
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v));
const bool = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.enum(['true', 'false']))
  .transform((v) => v === 'true');
const number = (min: number, max: number) =>
  z.string().trim().min(1).transform(Number).pipe(z.number().min(min).max(max));
const optionalPercent = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Number(v)))
  .pipe(z.number().min(0).max(100).nullable());

const latitude = number(-90, 90);
const longitude = number(-180, 180);

export const stationCsvSchema = z
  .object({
    name: text,
    lines: z.string().trim(),
    latitude,
    longitude,
    is_pilot: bool,
    is_demo_data: bool,
  })
  .transform(
    (r): TableInsert<'stations'> => ({
      ...r,
      lines: r.lines
        .split('|')
        .map((l) => l.trim())
        .filter(Boolean),
    }),
  );

export type FacilitySeed = { stationName: string; row: Omit<TableInsert<'facilities'>, 'station_id'> };

export const facilityCsvSchema = z
  .object({
    station_name: text,
    type: z.enum(['water', 'charging']),
    name: text,
    platform: optionalText,
    location_detail: optionalText,
    level: z
      .string()
      .trim()
      .transform((v) => v || 'L1'),
    latitude,
    longitude,
    layout_x: optionalPercent,
    layout_y: optionalPercent,
    is_active: bool,
    is_demo_data: bool,
  })
  .transform(({ station_name, ...row }): FacilitySeed => ({ stationName: station_name, row }));

export type ScheduleSeed = { stationName: string; row: Omit<TableInsert<'schedules'>, 'station_id'> };

export const scheduleCsvSchema = z
  .object({
    station_name: text,
    line: text,
    direction: text,
    day_type: z.enum(['weekday', 'weekend']),
    departure_time: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'expected HH:MM or HH:MM:SS'),
  })
  .transform(
    ({ station_name, departure_time, ...rest }): ScheduleSeed => ({
      stationName: station_name,
      row: { ...rest, departure_time: normalizeTime(departure_time) },
    }),
  );

/** "05:00" -> "05:00:00", matching how Postgres returns a time column. */
export function normalizeTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

/** Validates every record and reports the CSV line number (header = line 1) of the first bad row. */
export function parseRecords<T>(records: CsvRecord[], schema: z.ZodType<T>, fileLabel: string): T[] {
  return records.map((record, index) => {
    const result = schema.safeParse(record);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new Error(`${fileLabel} line ${index + 2}: ${issue.path.join('.') || 'row'} ${issue.message}`);
    }
    return result.data;
  });
}
