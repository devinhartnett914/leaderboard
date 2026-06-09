-- trime initial schema
-- Run this in the Supabase SQL editor (or via the Supabase CLI) to create the database.
-- Rollback script lives in supabase/rollback/0001_init.down.sql

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type sport as enum ('triathlon', 'swim_meet', 'gravel', 'trail_run', 'road_run', 'other');
create type result_status as enum ('finished', 'dnf', 'dns', 'dq');
-- why a row is stored: the family member, a podium finisher, or someone who
-- finished near a family member (used for "same podium people every year" context)
create type result_context as enum ('family', 'podium', 'neighbor');
create type segment_type as enum ('leg', 'lap', 'distance', 'checkpoint');

-- ---------------------------------------------------------------------------
-- person — family members AND scraped competitors are both "people".
-- is_family = true  -> a family member we track (has a slug + page).
-- is_family = false -> a competitor auto-created from a scrape, matched across
--                      editions by normalized_name to detect recurring rivals.
-- ---------------------------------------------------------------------------
create table person (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  normalized_name text not null,            -- lowercased, trimmed; used for cross-year matching
  slug            text unique,              -- only family members get a slug / page
  is_family       boolean not null default false,
  birth_year      int,
  gender          text,
  avatar_url      text,
  notes           text,
  created_at      timestamptz not null default now()
);
create index person_normalized_name_idx on person (normalized_name);
create index person_is_family_idx on person (is_family);

-- ---------------------------------------------------------------------------
-- race — the recurring event identity you click into for year-over-year.
-- ---------------------------------------------------------------------------
create table race (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  sport       sport not null,
  location    text,
  description text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- race_edition — one running of a race in one year.
-- ---------------------------------------------------------------------------
create table race_edition (
  id                 uuid primary key default gen_random_uuid(),
  race_id            uuid not null references race (id) on delete cascade,
  year               int not null,
  date               date,
  source_url         text,                  -- link back to the full original results
  host_platform      text,                  -- e.g. athlinks, runsignup, raceroster
  distance_or_format text,                  -- e.g. "Olympic", "Half", "50K", "100m Free"
  weather            text,
  name_override      text,                  -- if this edition was named differently
  notes              text,
  created_at         timestamptz not null default now(),
  unique (race_id, year)
);
create index race_edition_race_id_idx on race_edition (race_id);

-- ---------------------------------------------------------------------------
-- result — one person's result in one edition.
-- event is null for single-result sports; for swim meets it holds the event
-- (e.g. "100 Free") so YoY can compare the same event across years.
-- ---------------------------------------------------------------------------
create table result (
  id                 uuid primary key default gen_random_uuid(),
  race_edition_id    uuid not null references race_edition (id) on delete cascade,
  person_id          uuid not null references person (id) on delete cascade,
  event              text,
  finish_time_seconds int,
  overall_place      int,
  overall_field_size int,
  division           text,                  -- e.g. "M40-44"
  division_place     int,
  division_size      int,
  gender_place       int,
  bib                text,
  status             result_status not null default 'finished',
  context            result_context not null default 'family',
  created_at         timestamptz not null default now()
);
create index result_race_edition_id_idx on result (race_edition_id);
create index result_person_id_idx on result (person_id);
-- one row per person per edition per event
create unique index result_unique_person_edition_event
  on result (race_edition_id, person_id, (coalesce(event, '')));

-- ---------------------------------------------------------------------------
-- split — normalized leg/lap/checkpoint splits so YoY split charts are clean.
-- ---------------------------------------------------------------------------
create table split (
  id                     uuid primary key default gen_random_uuid(),
  result_id              uuid not null references result (id) on delete cascade,
  sequence               int not null,      -- order within the result
  label                  text not null,     -- "Swim" / "Bike" / "Run" / "Lap 2" / "Mile 3" / "5K"
  segment_type           segment_type not null default 'distance',
  distance_m             numeric,
  segment_time_seconds   int,               -- time for this segment alone
  cumulative_time_seconds int               -- elapsed time at the end of this segment
);
create index split_result_id_idx on split (result_id);
create unique index split_unique_result_sequence on split (result_id, sequence);

-- ---------------------------------------------------------------------------
-- Row-Level Security: anyone may read; only authenticated users may write.
-- (The server-side service-role key bypasses RLS for scrape/save endpoints.)
-- ---------------------------------------------------------------------------
alter table person       enable row level security;
alter table race         enable row level security;
alter table race_edition enable row level security;
alter table result       enable row level security;
alter table split        enable row level security;

create policy "public read" on person       for select using (true);
create policy "public read" on race         for select using (true);
create policy "public read" on race_edition for select using (true);
create policy "public read" on result       for select using (true);
create policy "public read" on split        for select using (true);

create policy "authenticated write" on person       for all to authenticated using (true) with check (true);
create policy "authenticated write" on race         for all to authenticated using (true) with check (true);
create policy "authenticated write" on race_edition for all to authenticated using (true) with check (true);
create policy "authenticated write" on result       for all to authenticated using (true) with check (true);
create policy "authenticated write" on split        for all to authenticated using (true) with check (true);
