-- Map a race to its platform source(s) so imports match by external race id, not
-- by name. This makes renaming a race safe, and lets several platform race ids
-- (e.g. the spring + fall running of the same course) point at one race.

create table race_source (
	id          uuid primary key default gen_random_uuid(),
	race_id     uuid not null references race (id) on delete cascade,
	platform    text not null,            -- e.g. 'runsignup'
	external_id text not null,            -- the platform's race id
	created_at  timestamptz not null default now(),
	unique (platform, external_id)
);
create index race_source_race_id_idx on race_source (race_id);

alter table race_source enable row level security;
create policy "public read" on race_source for select using (true);
create policy "authenticated write" on race_source for all to authenticated using (true) with check (true);

-- Rollback:
-- drop table if exists race_source cascade;
