-- FindToFill: reports, reviews, and report photos are written only by the server.
--
-- Before this migration, signed-in users could insert reports and reviews and upload report
-- photos directly through the Supabase REST API (the URL and anon key are public). That skipped
-- the route handlers' checks: required photo, rate limits, active facility, and the server-made
-- review embedding. Route handlers now verify the user and write with the service role, which
-- bypasses RLS. Clients keep read access and admins keep the soft delete.
--
-- Deploy together with the code that writes through the service role: old code fails with 403.

-- ---------------------------------------------------------------------------
-- reports: no client inserts. Admin soft delete is unchanged.
-- ---------------------------------------------------------------------------
drop policy "reports: insert own" on public.reports;
revoke insert on public.reports from anon, authenticated;

-- ---------------------------------------------------------------------------
-- reviews: no client inserts or owner edits. Admins may only set the soft-delete columns
-- (before, the column grant also let them change another user's rating and comment).
-- Revoking table-level update also revokes the old column grants.
-- ---------------------------------------------------------------------------
drop policy "reviews: insert own" on public.reviews;
drop policy "reviews: update own" on public.reviews;
revoke insert on public.reviews from anon, authenticated;
revoke update on public.reviews from anon, authenticated;
grant update (removed_at, removed_by) on public.reviews to authenticated;

-- ---------------------------------------------------------------------------
-- report-photos: uploads go through POST /api/reports only (type, size, and rate limit checked).
-- ---------------------------------------------------------------------------
drop policy "report-photos: insert own folder" on storage.objects;

-- ---------------------------------------------------------------------------
-- profiles: cap the display name taken from sign-up metadata (user-controlled).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    ), 50)
  );
  return new;
end;
$$;

-- create or replace keeps existing grants, but restate the revoke in case it was recreated.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
