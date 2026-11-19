import { z } from 'zod';
import type { TableInsert, TableUpdate } from '@/lib/supabase/database.types';

// Admin edit payloads (camelCase, as the frontend sends them) and their mapping to DB columns.
// strict(): unknown keys such as isDemoData or id are rejected instead of silently ignored.

/** Empty text clears the column. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable();
const percent = z.number().min(0).max(100).nullable();
const atLeastOneField = (value: object) => Object.keys(value).length > 0;

export const facilityUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    type: z.enum(['water', 'charging']),
    platform: optionalText(120),
    locationDetail: optionalText(300),
    level: z.string().trim().min(1).max(40),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    layoutX: percent,
    layoutY: percent,
    isActive: z.boolean(),
  })
  .partial()
  .strict()
  .refine(atLeastOneField, 'Nothing to update.');

export type FacilityUpdateInput = z.infer<typeof facilityUpdateSchema>;

export function toFacilityUpdate(input: FacilityUpdateInput): TableUpdate<'facilities'> {
  return omitUndefined({
    name: input.name,
    type: input.type,
    platform: input.platform,
    location_detail: input.locationDetail,
    level: input.level,
    latitude: input.latitude,
    longitude: input.longitude,
    layout_x: input.layoutX,
    layout_y: input.layoutY,
    is_active: input.isActive,
  });
}

export const stationUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    lines: z.array(z.string().trim().min(1).max(60)).max(10),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    isPilot: z.boolean(),
  })
  .partial()
  .strict()
  .refine(atLeastOneField, 'Nothing to update.');

export type StationUpdateInput = z.infer<typeof stationUpdateSchema>;

export function toStationUpdate(input: StationUpdateInput): TableUpdate<'stations'> {
  return omitUndefined({
    name: input.name,
    lines: input.lines,
    latitude: input.latitude,
    longitude: input.longitude,
    is_pilot: input.isPilot,
  });
}

// ---------------------------------------------------------------------------
// Create payloads (Stations tab). New rows are real data: is_demo_data stays false.
// ---------------------------------------------------------------------------

export const stationCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    lines: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    isPilot: z.boolean().default(true),
  })
  .strict();

export type StationCreateInput = z.infer<typeof stationCreateSchema>;

export function toStationInsert(input: StationCreateInput): TableInsert<'stations'> {
  return {
    name: input.name,
    lines: input.lines,
    latitude: input.latitude,
    longitude: input.longitude,
    is_pilot: input.isPilot,
  };
}

export const facilityCreateSchema = z
  .object({
    stationId: z.uuid(),
    type: z.enum(['water', 'charging']),
    name: z.string().trim().min(1).max(120),
    platform: optionalText(120).optional(),
    locationDetail: optionalText(300).optional(),
    level: z.string().trim().min(1).max(40).default('L1'),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    layoutX: percent.optional(),
    layoutY: percent.optional(),
    isActive: z.boolean().default(true),
  })
  .strict();

export type FacilityCreateInput = z.infer<typeof facilityCreateSchema>;

export function toFacilityInsert(input: FacilityCreateInput): TableInsert<'facilities'> {
  return {
    station_id: input.stationId,
    type: input.type,
    name: input.name,
    platform: input.platform ?? null,
    location_detail: input.locationDetail ?? null,
    level: input.level,
    latitude: input.latitude,
    longitude: input.longitude,
    layout_x: input.layoutX ?? null,
    layout_y: input.layoutY ?? null,
    is_active: input.isActive,
  };
}

/** One departure. Time is station-local (WIB) as HH:MM, 24-hour. */
export const scheduleCreateSchema = z
  .object({
    line: z.string().trim().min(1).max(60),
    direction: z.string().trim().min(1).max(80),
    dayType: z.enum(['weekday', 'weekend']),
    departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour), e.g. 05:30.'),
  })
  .strict();

export type ScheduleCreateInput = z.infer<typeof scheduleCreateSchema>;

export const scheduleListQuerySchema = z.object({ dayType: z.enum(['weekday', 'weekend']).optional() }).strict();

function omitUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}
