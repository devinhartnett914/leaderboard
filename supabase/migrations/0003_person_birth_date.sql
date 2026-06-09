-- Store full date of birth so we can show current age (and compute race-day age
-- for age groups) rather than just the birth year.

alter table person add column if not exists birth_date date;

-- Rollback:
-- alter table person drop column if exists birth_date;
