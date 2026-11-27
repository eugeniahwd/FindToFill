import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Static checks on the SQL migrations: they catch a forgotten RLS line or a
// service-only table that was accidentally opened to clients.
const dir = join(process.cwd(), 'supabase', 'migrations');
const sql = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(dir, f), 'utf8'))
  .join('\n')
  .toLowerCase();

const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);

describe('supabase migrations', () => {
  it('define every table from docs/DATA_MODEL.md', () => {
    expect(tables.sort()).toEqual(
      [
        'chat_logs', 'facilities', 'favorites', 'profiles', 'rate_limit_events', 'reports',
        'reviews', 'schedules', 'stamps', 'station_layouts', 'stations',
      ].sort(),
    );
  });

  it.each(tables)('enable RLS on %s', (table) => {
    expect(sql).toMatch(new RegExp(`alter table public\\.${table}\\s+enable row level security`));
  });

  it.each(['rate_limit_events', 'chat_logs', 'stamps'])('give clients no policy that writes to %s', (table) => {
    expect(sql).not.toMatch(new RegExp(`on public\\.${table}\\s+for (insert|update|delete|all)`));
  });

  it('let clients update only the soft-delete columns of reports', () => {
    expect(sql).toContain('revoke update, delete on public.reports from anon, authenticated');
    expect(sql).toContain('grant update (removed_at, removed_by) on public.reports to authenticated');
  });

  // Reports, reviews, and report photos are written only by the server (service role), after the
  // route has checked the session, the photo, and the rate limit.
  const droppedLater = (create: string, drop: string) => sql.lastIndexOf(drop) > sql.lastIndexOf(create);

  it.each(['reports: insert own', 'reviews: insert own', 'reviews: update own'])(
    'drop the client write policy "%s"',
    (name) => {
      expect(droppedLater(`create policy "${name}"`, `drop policy "${name}"`)).toBe(true);
    },
  );

  it.each(['reports', 'reviews'])('revoke client inserts on %s', (table) => {
    expect(sql).toContain(`revoke insert on public.${table} from anon, authenticated`);
  });

  it('let clients update only the soft-delete columns of reviews', () => {
    expect(droppedLater('grant update (rating, comment, embedding', 'revoke update on public.reviews from anon, authenticated')).toBe(true);
    expect(sql).toContain('grant update (removed_at, removed_by) on public.reviews to authenticated');
  });

  it('let clients upload nothing to report-photos', () => {
    const name = 'report-photos: insert own folder';
    expect(droppedLater(`create policy "${name}"`, `drop policy "${name}" on storage.objects`)).toBe(true);
  });

  it('cap the sign-up display name in the latest profile trigger', () => {
    const definitions = [...sql.matchAll(/function public\.handle_new_user\(\)\s+returns trigger[\s\S]*?\$\$;/g)];
    expect(definitions.at(-1)?.[0]).toMatch(/left\(\s*coalesce\(/);
  });

  it('never let clients write profiles (role cannot be self-assigned)', () => {
    expect(sql).toContain('revoke insert, update, delete on public.profiles from anon, authenticated');
    expect(sql).not.toMatch(/on public\.profiles\s+for (insert|update|delete|all)/);
  });

  it('compute status from a 7-day window, never stored', () => {
    expect(sql).toContain("interval '7 days'");
    expect(sql).toContain('create view public.facility_status with (security_invoker = true)');
  });

  it('keep report photos in a private bucket', () => {
    expect(sql).toMatch(/\('report-photos',\s*'report-photos',\s*false/);
  });
});
