-- Rollback for 0006_result_subsecond_time.sql.
-- Additive column, so removing it is a clean drop (no data reshaping). Any swim
-- results lose their hundredths precision but keep finish_time_seconds.

alter table result drop column if exists finish_time_cs;
