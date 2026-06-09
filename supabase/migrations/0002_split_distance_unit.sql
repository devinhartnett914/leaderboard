-- Add a per-split display unit so each leg can render in its natural unit:
-- swim in 'm' or 'yd' (varies by race), bike in 'mi', run in 'km'.
-- distance_m stays the canonical value (meters) used for pace math.

alter table split add column if not exists distance_unit text;

-- Rollback:
-- alter table split drop column if exists distance_unit;
