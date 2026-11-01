import { z } from 'zod';
import type { TableUpdate } from '@/lib/supabase/database.types';

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

function omitUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}
