-- Add an open-water swim sport (lake/bay/river swims), distinct from pool swim meets.
-- Postgres can't drop an enum value, so the rollback recreates the type without it.

alter type sport add value if not exists 'open_water';

-- Rollback: see supabase/rollback/0005_open_water_sport.sql
