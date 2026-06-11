-- Sub-second finish times for swimming.
--
-- A swim PR can come down to 1/100th of a second, but result.finish_time_seconds
-- is whole-second integer (correct for tri/run, lossy for swim). Rather than
-- change that column — there are already real results in it, and the UI reads it
-- as whole seconds — we ADD a nullable hundredths column. Purely additive: existing
-- rows and existing pages are untouched. Whole-second sports leave it null; swim
-- sets both finish_time_seconds (rounded, so generic lists still work) and
-- finish_time_cs (exact, for precise swim display).
--
-- (Integer hundredths, not numeric: PostgREST returns numeric as a JSON string,
-- which would silently break time math in the UI. int comes back as a number.)

alter table result add column if not exists finish_time_cs int;

comment on column result.finish_time_cs is
  'Finish time in hundredths of a second, for sub-second sports (swimming). Null for whole-second sports, which use finish_time_seconds.';

-- Rollback: supabase/rollback/0006_result_subsecond_time.sql
