-- Rollback for 0001_init.sql — drops everything the migration created.
-- Run only if you need to fully reset the schema. THIS DELETES ALL DATA.

drop table if exists split cascade;
drop table if exists result cascade;
drop table if exists race_edition cascade;
drop table if exists race cascade;
drop table if exists person cascade;

drop type if exists segment_type;
drop type if exists result_context;
drop type if exists result_status;
drop type if exists sport;
