-- FindToFill: Row Level Security on every table.
-- Roles: anon (guest), authenticated (commuter or admin). The service role bypasses RLS
-- and is used only in server route handlers (stamps, rate limits, chat logs, signed URLs).

alter table public.profiles          enable row level security;
alter table public.stations          enable row level security;
alter table public.station_layouts   enable row level security;
alter table public.facilities        enable row level security;
alter table public.reports           enable row level security;
alter table public.reviews           enable row level security;
alter table public.favorites         enable row level security;
alter table public.stamps            enable row level security;
alter table public.schedules         enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.chat_logs         enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: read own row, admin reads all. Nobody updates through the API;
-- admins are assigned manually in the SQL editor.
-- ---------------------------------------------------------------------------
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles: admin reads all" on public.profiles
  for select to authenticated using (public.is_admin());

revoke insert, update, delete on public.profiles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reference data: public read, admin write.
-- ---------------------------------------------------------------------------
create policy "stations: public read" on public.stations
  for select to anon, authenticated using (true);
create policy "stations: admin insert" on public.stations
  for insert to authenticated with check (public.is_admin());
create policy "stations: admin update" on public.stations
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "stations: admin delete" on public.stations
  for delete to authenticated using (public.is_admin());

create policy "station_layouts: public read" on public.station_layouts
  for select to anon, authenticated using (true);
create policy "station_layouts: admin insert" on public.station_layouts
  for insert to authenticated with check (public.is_admin());
create policy "station_layouts: admin update" on public.station_layouts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "station_layouts: admin delete" on public.station_layouts
  for delete to authenticated using (public.is_admin());

create policy "facilities: public read active" on public.facilities
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "facilities: admin insert" on public.facilities
  for insert to authenticated with check (public.is_admin());
create policy "facilities: admin update" on public.facilities
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "facilities: admin delete" on public.facilities
  for delete to authenticated using (public.is_admin());

create policy "schedules: public read" on public.schedules
  for select to anon, authenticated using (true);
create policy "schedules: admin insert" on public.schedules
  for insert to authenticated with check (public.is_admin());
create policy "schedules: admin update" on public.schedules
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "schedules: admin delete" on public.schedules
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- reports: public read when not removed; users insert their own; only admins
-- may soft-delete (set removed_at / removed_by). No hard deletes.
-- ---------------------------------------------------------------------------
create policy "reports: public read active" on public.reports
  for select to anon, authenticated using (removed_at is null or public.is_admin());
create policy "reports: insert own" on public.reports
  for insert to authenticated
  with check (user_id = auth.uid() and removed_at is null and removed_by is null);
create policy "reports: admin soft delete" on public.reports
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin() and (removed_by is null or removed_by = auth.uid()));

revoke update, delete on public.reports from anon, authenticated;
grant update (removed_at, removed_by) on public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- reviews: public read when not removed; one per user per facility (unique);
-- owner edits rating/comment/embedding; admins soft-delete.
-- ---------------------------------------------------------------------------
create policy "reviews: public read active" on public.reviews
  for select to anon, authenticated using (removed_at is null or public.is_admin());
create policy "reviews: insert own" on public.reviews
  for insert to authenticated
  with check (user_id = auth.uid() and removed_at is null and removed_by is null);
create policy "reviews: update own" on public.reviews
  for update to authenticated
  using (user_id = auth.uid() and removed_at is null)
  with check (user_id = auth.uid() and removed_at is null and removed_by is null);
create policy "reviews: admin soft delete" on public.reviews
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin() and (removed_by is null or removed_by = auth.uid()));

revoke update, delete on public.reviews from anon, authenticated;
grant update (rating, comment, embedding, removed_at, removed_by) on public.reviews to authenticated;

-- ---------------------------------------------------------------------------
-- favorites: own rows only.
-- ---------------------------------------------------------------------------
create policy "favorites: read own" on public.favorites
  for select to authenticated using (user_id = auth.uid());
create policy "favorites: insert own" on public.favorites
  for insert to authenticated with check (user_id = auth.uid());
create policy "favorites: delete own" on public.favorites
  for delete to authenticated using (user_id = auth.uid());

revoke update on public.favorites from anon, authenticated;

-- ---------------------------------------------------------------------------
-- stamps: users read their own; inserts happen server-side (service role).
-- ---------------------------------------------------------------------------
create policy "stamps: read own" on public.stamps
  for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.stamps from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Server-only tables: RLS on, no policies, no grants.
-- ---------------------------------------------------------------------------
revoke all on public.rate_limit_events from anon, authenticated;
revoke all on public.chat_logs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant select on public.facility_status to anon, authenticated;
