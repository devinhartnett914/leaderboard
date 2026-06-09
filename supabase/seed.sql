-- SAMPLE DATA — replace with your real family + races once the app is running.
-- This exists so the display pages (person page, YoY comparison, rivalry context)
-- render with realistic data immediately. Safe to delete and re-run.
-- Re-running: this clears the sample rows first, so it's idempotent.

begin;

-- Clear prior sample rows (by the fixed UUIDs below) so re-running is safe.
delete from race where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
delete from person where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
);

-- People -------------------------------------------------------------------
insert into person (id, full_name, normalized_name, slug, is_family, birth_year, gender) values
  ('11111111-1111-1111-1111-111111111111', 'Devin Hartnett', 'devin hartnett', 'devin-hartnett', true, 1986, 'M'),
  ('22222222-2222-2222-2222-222222222222', 'Sam Hartnett',   'sam hartnett',   'sam-hartnett',   true, 1988, 'F'),
  -- competitors (auto-created from scrapes in real use): kept for podium/rivalry context
  ('33333333-3333-3333-3333-333333333333', 'Mike Rivera', 'mike rivera', null, false, null, 'M'),
  ('44444444-4444-4444-4444-444444444444', 'Jen Park',    'jen park',    null, false, null, 'F');

-- Recurring race + two editions -------------------------------------------
insert into race (id, name, slug, sport, location, description) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pumpkinman Triathlon', 'pumpkinman-triathlon', 'triathlon',
   'South Berwick, ME', 'Olympic-distance triathlon the family does every fall.');

insert into race_edition (id, race_id, year, date, source_url, host_platform, distance_or_format) values
  ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2023, '2023-09-17',
   'https://www.athlinks.com/event/example/results/Event/000000/Results', 'athlinks', 'Olympic'),
  ('a2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2024, '2024-09-15',
   'https://www.athlinks.com/event/example/results/Event/000001/Results', 'athlinks', 'Olympic');

-- Results ------------------------------------------------------------------
-- Devin: improves year over year (faster on every leg, moves onto the podium in 2024)
insert into result (id, race_edition_id, person_id, finish_time_seconds, overall_place, overall_field_size, division, division_place, division_size, status, context) values
  ('d1000000-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 8070, 24, 180, 'M35-39', 5, 28, 'finished', 'family'),
  ('d1000000-0000-0000-0000-000000000002', 'a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 7770, 18, 195, 'M35-39', 3, 31, 'finished', 'family');

-- Sam: also improving
insert into result (id, race_edition_id, person_id, finish_time_seconds, overall_place, overall_field_size, division, division_place, division_size, status, context) values
  ('d2000000-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 9900, 78, 180, 'F35-39', 12, 22, 'finished', 'family'),
  ('d2000000-0000-0000-0000-000000000002', 'a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 9480, 65, 195, 'F35-39', 9, 25, 'finished', 'family');

-- Mike Rivera: shares the M35-39 podium with Devin BOTH years (the rivalry insight)
insert into result (id, race_edition_id, person_id, finish_time_seconds, overall_place, overall_field_size, division, division_place, division_size, status, context) values
  ('d3000000-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 7950, 19, 180, 'M35-39', 3, 28, 'finished', 'podium'),
  ('d3000000-0000-0000-0000-000000000002', 'a2222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 7710, 15, 195, 'M35-39', 2, 31, 'finished', 'podium');

-- Jen Park: finishes near Sam both years
insert into result (id, race_edition_id, person_id, finish_time_seconds, overall_place, overall_field_size, division, division_place, division_size, status, context) values
  ('d4000000-0000-0000-0000-000000000001', 'a1111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 9990, 81, 180, 'F35-39', 13, 22, 'finished', 'neighbor'),
  ('d4000000-0000-0000-0000-000000000002', 'a2222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 9540, 67, 195, 'F35-39', 10, 25, 'finished', 'neighbor');

-- Splits (Swim / Bike / Run) for the family members, both years -----------
-- Devin 2023
insert into split (result_id, sequence, label, segment_type, segment_time_seconds, cumulative_time_seconds) values
  ('d1000000-0000-0000-0000-000000000001', 1, 'Swim', 'leg', 1110, 1110),
  ('d1000000-0000-0000-0000-000000000001', 2, 'Bike', 'leg', 4080, 5190),
  ('d1000000-0000-0000-0000-000000000001', 3, 'Run',  'leg', 2880, 8070);
-- Devin 2024 (faster everywhere)
insert into split (result_id, sequence, label, segment_type, segment_time_seconds, cumulative_time_seconds) values
  ('d1000000-0000-0000-0000-000000000002', 1, 'Swim', 'leg', 1050, 1050),
  ('d1000000-0000-0000-0000-000000000002', 2, 'Bike', 'leg', 3960, 5010),
  ('d1000000-0000-0000-0000-000000000002', 3, 'Run',  'leg', 2760, 7770);
-- Sam 2023
insert into split (result_id, sequence, label, segment_type, segment_time_seconds, cumulative_time_seconds) values
  ('d2000000-0000-0000-0000-000000000001', 1, 'Swim', 'leg', 1380, 1380),
  ('d2000000-0000-0000-0000-000000000001', 2, 'Bike', 'leg', 4920, 6300),
  ('d2000000-0000-0000-0000-000000000001', 3, 'Run',  'leg', 3600, 9900);
-- Sam 2024 (faster)
insert into split (result_id, sequence, label, segment_type, segment_time_seconds, cumulative_time_seconds) values
  ('d2000000-0000-0000-0000-000000000002', 1, 'Swim', 'leg', 1320, 1320),
  ('d2000000-0000-0000-0000-000000000002', 2, 'Bike', 'leg', 4740, 6060),
  ('d2000000-0000-0000-0000-000000000002', 3, 'Run',  'leg', 3420, 9480);

commit;
