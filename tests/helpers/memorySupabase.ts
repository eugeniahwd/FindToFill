// A tiny in-memory Supabase client that really filters rows, for running data-layer code (such
// as SupabaseDataProvider) against seeded tables. Supports what that code uses: select with a
// plain column list, eq, in, is, gt, gte, order, limit, and rpc handlers. Not a SQL engine:
// views and RLS are not emulated, and embedded selects like "facilities(name)" are rejected.

import type { ProviderSeed } from '@/lib/chatbot/data/provider';

export type Row = Record<string, unknown>;
type Predicate = (row: Row) => boolean;
type RpcHandler = (args: Record<string, unknown>) => { data: unknown; error: unknown };

export interface MemoryCall {
  table: string;
  kind: 'select' | 'rpc';
  args?: Record<string, unknown>;
}

// Values here are ISO timestamps, HH:MM:SS times, numbers, or text: plain comparison orders them.
const compare = (a: unknown, b: unknown) => {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return (a as number | string) < (b as number | string) ? -1 : 1;
};

export function memorySupabase(tables: Record<string, Row[]>, rpcHandlers: Record<string, RpcHandler> = {}) {
  const calls: MemoryCall[] = [];

  function from(table: string) {
    calls.push({ table, kind: 'select' });
    const predicates: Predicate[] = [];
    const orders: { column: string; ascending: boolean }[] = [];
    let columns: string[] | null = null;
    let max: number | null = null;

    const run = () => {
      const source = tables[table];
      if (!source) return { data: null, error: { code: '42P01', message: `no table ${table}` } };
      let rows = source.filter((row) => predicates.every((p) => p(row)));
      if (orders.length > 0) {
        rows = [...rows].sort((a, b) => {
          for (const { column, ascending } of orders) {
            const c = compare(a[column], b[column]);
            if (c !== 0) return ascending ? c : -c;
          }
          return 0;
        });
      }
      if (max !== null) rows = rows.slice(0, max);
      const data = columns ? rows.map((row) => Object.fromEntries(columns!.map((c) => [c, row[c]]))) : rows;
      return { data, error: null };
    };

    const builder = {
      select(list = '*') {
        if (list.includes('(')) throw new Error(`memorySupabase: embedded select not supported: ${list}`);
        columns = list.trim() === '*' ? null : list.split(',').map((c) => c.trim());
        return builder;
      },
      eq: (column: string, value: unknown) => (predicates.push((r) => r[column] === value), builder),
      in: (column: string, values: unknown[]) => (predicates.push((r) => values.includes(r[column])), builder),
      is: (column: string, value: null) => (predicates.push((r) => r[column] === value), builder),
      gt: (column: string, value: unknown) => (predicates.push((r) => compare(r[column], value) > 0), builder),
      gte: (column: string, value: unknown) => (predicates.push((r) => compare(r[column], value) >= 0), builder),
      order(column: string, options: { ascending?: boolean } = {}) {
        orders.push({ column, ascending: options.ascending ?? true });
        return builder;
      },
      limit(n: number) {
        max = n;
        return builder;
      },
      then<T>(resolve: (r: ReturnType<typeof run>) => T, reject?: (e: unknown) => T) {
        return Promise.resolve().then(run).then(resolve, reject);
      },
    };
    return builder;
  }

  async function rpc(name: string, args: Record<string, unknown>) {
    calls.push({ table: name, kind: 'rpc', args });
    const handler = rpcHandlers[name];
    return handler ? handler(args) : { data: null, error: { code: 'PGRST202', message: `no rpc ${name}` } };
  }

  return { client: { from, rpc }, calls };
}

/** "HH:MM" -> "HH:MM:SS", the way Postgres returns a time column. */
const pgTime = (value: string) => (value.length === 5 ? `${value}:00` : value);

/** ProviderSeed (contract test rows) -> database-shaped tables. */
export function tablesFromSeed(seed: ProviderSeed): Record<string, Row[]> {
  return {
    stations: seed.stations.map((s) => ({
      id: s.id, name: s.name, lines: [], latitude: s.latitude, longitude: s.longitude, is_pilot: s.isPilot, is_demo_data: false,
    })),
    facilities: seed.facilities.map((f) => ({
      id: f.id, station_id: f.stationId, type: f.type, name: f.name, platform: f.platform, location_detail: f.locationDetail,
      level: f.level, latitude: f.latitude, longitude: f.longitude, layout_x: null, layout_y: null,
      is_active: f.isActive, is_demo_data: false,
    })),
    reports: seed.reports.map((r, i) => ({
      id: `report-${i}`, facility_id: r.facilityId, user_id: 'user-1', status: r.status, photo_path: `user-1/${i}.jpg`,
      note: null, created_at: r.createdAt, removed_at: r.removedAt, removed_by: r.removedAt ? 'admin-1' : null,
    })),
    schedules: seed.schedules.map((s, i) => ({
      id: `schedule-${i}`, station_id: s.stationId, line: s.line, direction: s.direction, day_type: s.dayType,
      departure_time: pgTime(s.departureTime),
    })),
    reviews: seed.reviews.map((r, i) => ({
      id: `review-${i}`, facility_id: r.facilityId, user_id: `user-${i}`, rating: r.rating, comment: r.comment,
      created_at: r.createdAt, updated_at: r.createdAt, removed_at: r.removedAt, removed_by: r.removedAt ? 'admin-1' : null,
      embedding: null,
    })),
  };
}
