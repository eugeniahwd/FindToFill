# Data Model (Supabase PostgreSQL)

Write these as migrations in supabase/migrations. Enable RLS on every table. Use gen_random_uuid() for ids.

## Tables
```sql
create extension if not exists vector;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'commuter' check (role in ('commuter','admin')),
  created_at timestamptz not null default now()
);
-- trigger on auth.users insert creates a profiles row (display_name from email prefix)

create table stations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  lines text[] not null default '{}',
  latitude double precision not null,
  longitude double precision not null,
  is_pilot boolean not null default true,
  is_demo_data boolean not null default false
);

create table station_layouts (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  level text not null default 'L1',
  image_url text not null,
  notes text,
  unique (station_id, level)
);

create table facilities (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  type text not null check (type in ('water','charging')),
  name text not null,
  platform text,
  location_detail text,
  level text default 'L1',
  latitude double precision not null,
  longitude double precision not null,
  layout_x numeric,            -- 0 to 100 percent
  layout_y numeric,            -- 0 to 100 percent
  is_active boolean not null default true,
  is_demo_data boolean not null default false
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  user_id uuid not null references profiles(id),
  status text not null check (status in ('available','empty','broken','under_maintenance')),
  photo_path text not null,
  note text check (char_length(note) <= 140),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references profiles(id)
);
create index on reports (facility_id, created_at desc);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  user_id uuid not null references profiles(id),
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) <= 500),
  embedding vector(768),       -- dimension must match the embedding model output; verify in Google docs
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references profiles(id),
  unique (user_id, facility_id)
);

create table favorites (
  user_id uuid not null references profiles(id) on delete cascade,
  station_id uuid not null references stations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, station_id)
);

create table stamps (
  user_id uuid not null references profiles(id) on delete cascade,
  facility_id uuid not null references facilities(id) on delete cascade,
  stamped_at timestamptz not null default now(),
  primary key (user_id, facility_id)
);

create table schedules (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  line text not null,
  direction text not null,
  day_type text not null check (day_type in ('weekday','weekend')),
  departure_time time not null
);

create table rate_limit_events (
  id bigint generated always as identity primary key,
  key text not null,           -- user id or IP hash
  action text not null,        -- 'report', 'review', 'chat'
  created_at timestamptz not null default now()
);
create index on rate_limit_events (key, action, created_at desc);

create table chat_logs (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,    -- random anonymous id, no personal data
  quick_message_id text not null,
  tools_called jsonb not null default '[]',
  outcome text not null check (outcome in ('answered','fallback_no_data','fallback_ai_unavailable','rejected')),
  latency_ms integer,
  station_id uuid references stations(id),
  created_at timestamptz not null default now()
);
```

## View: current facility status (7-day window, computed, never stored)
```sql
create view facility_status with (security_invoker = true) as
select f.id as facility_id,
       r.status,
       r.created_at as last_reported_at,
       r.photo_path,
       coalesce(c.active_count, 0) as active_report_count
from facilities f
left join lateral (
  select status, created_at, photo_path from reports
  where facility_id = f.id and removed_at is null
    and created_at > now() - interval '7 days'
  order by created_at desc limit 1
) r on true
left join lateral (
  select count(*) as active_count from reports
  where facility_id = f.id and removed_at is null
    and created_at > now() - interval '7 days'
) c on true;
```
status is null when there is no active report: treat it as 'unknown' ("No recent report").

## Function: semantic review search
```sql
create function match_reviews(query_embedding vector(768), p_station_id uuid, match_count int default 5)
returns table (review_id uuid, facility_id uuid, rating smallint, comment text, created_at timestamptz, similarity float)
language sql stable as $$
  select r.id, r.facility_id, r.rating, r.comment, r.created_at, 1 - (r.embedding <=> query_embedding)
  from reviews r join facilities f on f.id = r.facility_id
  where f.station_id = p_station_id and r.removed_at is null and r.embedding is not null
  order by r.embedding <=> query_embedding
  limit match_count;
$$;
```

## RLS summary
- Helper: is_admin() security definer function that checks profiles.role = 'admin'.
- Public read: stations, station_layouts, facilities, schedules, facility_status, reports and reviews where removed_at is null.
- Authenticated insert: reports and reviews (user_id = auth.uid()), favorites (own).
- Update: own review (not removed), own favorites (delete). Admin can set removed_at and removed_by on reports and reviews, and insert, update, or delete stations, facilities, layouts, schedules.
- profiles: a user reads own row, admin reads all. Users cannot update role.
- stamps: a user selects own rows. Inserts happen server-side only (service role).
- rate_limit_events and chat_logs: no client access (service role only).

## Storage
- Bucket report-photos: PRIVATE. Path {user_id}/{uuid}.jpg. Upload through a server route that validates type and size. Read through signed URLs (1 hour).
- Bucket layouts: public read, admin write.

## Seed
Create supabase/seed/stations.csv, facilities.csv, schedules.csv templates and a seed script. Demo rows must be clearly marked and use approximate station-center coordinates from OpenStreetMap. The team replaces them with field data.
