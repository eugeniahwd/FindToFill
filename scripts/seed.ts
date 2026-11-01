/**
 * Seeds stations, facilities, and schedules from supabase/seed/*.csv.
 *
 *   npm run db:seed -- --dry-run   validate the CSV files only
 *   npm run db:seed                write to the Supabase project in .env.local (service role)
 *
 * Idempotent: stations are upserted by name, facilities are matched by (station, name) and
 * updated in place, schedules are inserted only when the exact row does not exist yet.
 * Nothing is deleted.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvConfig } from '@next/env';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/supabase/database.types';
import { parseCsv } from '../src/lib/seed/csv';
import {
  facilityCsvSchema,
  parseRecords,
  scheduleCsvSchema,
  stationCsvSchema,
  type FacilitySeed,
  type ScheduleSeed,
} from '../src/lib/seed/rows';

type Db = SupabaseClient<Database>;

const SEED_DIR = join(process.cwd(), 'supabase', 'seed');
const BATCH_SIZE = 500;

function readCsv(file: string) {
  return parseCsv(readFileSync(join(SEED_DIR, file), 'utf8'));
}

function fail(message: string): never {
  console.error(`Seed failed: ${message}`);
  process.exit(1);
}

async function seedStations(db: Db, stations: ReturnType<typeof loadSeedFiles>['stations']) {
  const { data, error } = await db.from('stations').upsert(stations, { onConflict: 'name' }).select('id, name');
  if (error) fail(`stations: ${error.message}`);
  return new Map(data.map((s) => [s.name, s.id]));
}

function stationIdFor(stationIds: Map<string, string>, name: string): string {
  const id = stationIds.get(name);
  if (!id) fail(`unknown station "${name}". Add it to stations.csv first.`);
  return id;
}

async function seedFacilities(db: Db, stationIds: Map<string, string>, facilities: FacilitySeed[]) {
  const { data: existing, error } = await db
    .from('facilities')
    .select('id, station_id, name')
    .in('station_id', [...stationIds.values()]);
  if (error) fail(`facilities: ${error.message}`);
  const existingIds = new Map(existing.map((f) => [`${f.station_id}|${f.name}`, f.id]));

  let inserted = 0;
  let updated = 0;
  for (const { stationName, row } of facilities) {
    const stationId = stationIdFor(stationIds, stationName);
    const id = existingIds.get(`${stationId}|${row.name}`);
    const result = id
      ? await db.from('facilities').update(row).eq('id', id)
      : await db.from('facilities').insert({ ...row, station_id: stationId });
    if (result.error) fail(`facility "${row.name}": ${result.error.message}`);
    if (id) updated++;
    else inserted++;
  }
  return { inserted, updated };
}

async function seedSchedules(db: Db, stationIds: Map<string, string>, schedules: ScheduleSeed[]) {
  const { data: existing, error } = await db
    .from('schedules')
    .select('station_id, line, direction, day_type, departure_time')
    .in('station_id', [...stationIds.values()]);
  if (error) fail(`schedules: ${error.message}`);

  const keyOf = (s: { station_id: string; line: string; direction: string; day_type: string; departure_time: string }) =>
    [s.station_id, s.line, s.direction, s.day_type, s.departure_time].join('|');
  const seen = new Set(existing.map(keyOf));

  const toInsert = schedules
    .map(({ stationName, row }) => ({ ...row, station_id: stationIdFor(stationIds, stationName) }))
    .filter((row) => {
      const key = keyOf(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const { error: insertError } = await db.from('schedules').insert(toInsert.slice(i, i + BATCH_SIZE));
    if (insertError) fail(`schedules: ${insertError.message}`);
  }
  return toInsert.length;
}

function loadSeedFiles() {
  return {
    stations: parseRecords(readCsv('stations.csv'), stationCsvSchema, 'stations.csv'),
    facilities: parseRecords(readCsv('facilities.csv'), facilityCsvSchema, 'facilities.csv'),
    schedules: parseRecords(readCsv('schedules.csv'), scheduleCsvSchema, 'schedules.csv'),
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  let files: ReturnType<typeof loadSeedFiles>;
  try {
    files = loadSeedFiles();
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }

  const stationNames = new Set(files.stations.map((s) => s.name));
  for (const { stationName } of [...files.facilities, ...files.schedules]) {
    if (!stationNames.has(stationName)) fail(`unknown station "${stationName}". Add it to stations.csv first.`);
  }

  console.log(
    `CSV OK: ${files.stations.length} stations, ${files.facilities.length} facilities, ${files.schedules.length} schedules.`,
  );
  if (dryRun) return;

  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) fail('set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.');

  const db = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stationIds = await seedStations(db, files.stations);
  const facilityResult = await seedFacilities(db, stationIds, files.facilities);
  const schedulesInserted = await seedSchedules(db, stationIds, files.schedules);

  console.log(
    `Seeded: ${stationIds.size} stations upserted, facilities ${facilityResult.inserted} inserted / ${facilityResult.updated} updated, ${schedulesInserted} schedules inserted.`,
  );
}

main().catch((err: unknown) => fail(err instanceof Error ? err.message : String(err)));
