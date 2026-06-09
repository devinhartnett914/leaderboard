-- Rollback for 0005_open_water_sport.sql.
-- Postgres has no "ALTER TYPE ... DROP VALUE", so we rebuild the enum without
-- 'open_water'. Any rows still using it must be reassigned first (this will error
-- otherwise, which is the safe behavior — no silent data loss).

alter table race alter column sport drop default;

alter type sport rename to sport_old;
create type sport as enum ('triathlon', 'swim_meet', 'gravel', 'trail_run', 'road_run', 'other');
alter table race alter column sport type sport using sport::text::sport;
drop type sport_old;
