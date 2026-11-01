-- FindToFill: core schema, current-status view, review search, helpers.
-- Source of truth: docs/DATA_MODEL.md

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'commuter' check (role in ('commuter','admin')),
  created_at timestamptz not null default now()
);

create table public.stations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  lines text[] not null default '{}',
  latitude double precision not null,
  longitude double precision not null,
  is_pilot boolean not null default true,
  is_demo_data boolean not null default false
);

create table public.station_layouts (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations(id) on delete cascade,
  level text not null default 'L1',
  image_url text not null,
  notes text,
  unique (station_id, level)
);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations(id) on delete cascade,
  type text not null check (type in ('water','charging')),
  name text not null,
  platform text,
  location_detail text,
  level text default 'L1',
  latitude double precision not null,
  longitude double precision not null,
  layout_x numeric check (layout_x between 0 and 100),
  layout_y numeric check (layout_y between 0 and 100),
  is_active boolean not null default true,
  is_demo_data boolean not null default false
);
create index facilities_station_id_idx on public.facilities (station_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  status text not null check (status in ('available','empty','broken','under_maintenance')),
  photo_path text not null,
  note text check (char_length(note) <= 140),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references public.profiles(id)
);
create index reports_facility_created_idx on public.reports (facility_id, created_at desc);
create index reports_user_created_idx on public.reports (user_id, created_at desc);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) <= 500),
  -- 768 = output_dimensionality requested from the Gemini embedding model.
  embedding extensions.vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references public.profiles(id),
  unique (user_id, facility_id)
);
create index reviews_facility_idx on public.reviews (facility_id);
create index reviews_embedding_idx on public.reviews
  using hnsw (embedding extensions.vector_cosine_ops);

create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  station_id uuid not null references public.stations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, station_id)
);

create table public.stamps (
  user_id uuid not null references public.profiles(id) on delete cascade,
  facility_id uuid not null references public.facilities(id) on delete cascade,
  stamped_at timestamptz not null default now(),
  primary key (user_id, facility_id)
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations(id) on delete cascade,
  line text not null,
  direction text not null,
  day_type text not null check (day_type in ('weekday','weekend')),
  departure_time time not null
);
create index schedules_station_day_time_idx on public.schedules (station_id, day_type, departure_time);

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  key text not null,           -- user id or IP hash
  action text not null,        -- 'report', 'review', 'chat'
  created_at timestamptz not null default now()
);
create index rate_limit_events_lookup_idx on public.rate_limit_events (key, action, created_at desc);

create table public.chat_logs (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,    -- random anonymous id, no personal data
  quick_message_id text not null,
  tools_called jsonb not null default '[]',
  outcome text not null check (outcome in ('answered','fallback_no_data','fallback_ai_unavailable','rejected')),
  latency_ms integer,
  station_id uuid references public.stations(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles: auto-create on sign up
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- security definer so RLS policies can call it without recursing into profiles RLS.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Current facility status: 7-day window, computed at read time, never stored.
-- status is null when there is no active report ("No recent report").
-- ---------------------------------------------------------------------------

create view public.facility_status with (security_invoker = true) as
select f.id as facility_id,
       r.status,
       r.created_at as last_reported_at,
       r.photo_path,
       coalesce(c.active_count, 0) as active_report_count
from public.facilities f
left join lateral (
  select status, created_at, photo_path from public.reports
  where facility_id = f.id and removed_at is null
    and created_at > now() - interval '7 days'
  order by created_at desc limit 1
) r on true
left join lateral (
  select count(*) as active_count from public.reports
  where facility_id = f.id and removed_at is null
    and created_at > now() - interval '7 days'
) c on true;

-- ---------------------------------------------------------------------------
-- Semantic review search (RAG for the review summary quick message)
-- ---------------------------------------------------------------------------

create function public.match_reviews(
  query_embedding extensions.vector(768),
  p_station_id uuid,
  match_count int default 5
)
returns table (
  review_id uuid,
  facility_id uuid,
  rating smallint,
  comment text,
  created_at timestamptz,
  similarity float
)
language sql
stable
set search_path = public, extensions
as $$
  select r.id, r.facility_id, r.rating, r.comment, r.created_at,
         1 - (r.embedding <=> query_embedding)
  from public.reviews r
  join public.facilities f on f.id = r.facility_id
  where f.station_id = p_station_id
    and r.removed_at is null
    and r.embedding is not null
  order by r.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;
