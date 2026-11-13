-- Customers: an own rounding rule that overrides the global setting (#77). Both columns empty means "use the global
-- setting" (every existing customer); rounding_minutes 0 means no rounding for this customer (rounding_direction is then
-- 'up' and not used). The steps are those of settings.rounding_minutes (migration 008): the list is in both checks, so a
-- migration that adds a step has to replace customers_rounding_minutes_check too. The checks have explicit names and allow
-- NULL explicitly (pg-mem, the test database, would otherwise refuse a NULL in an IN check). One transaction, so a failing
-- statement leaves nothing half done; every statement can run again.
BEGIN;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS rounding_minutes SMALLINT
  CONSTRAINT customers_rounding_minutes_check CHECK (rounding_minutes IS NULL OR rounding_minutes IN (0, 5, 10, 15, 30, 60));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS rounding_direction VARCHAR(7)
  CONSTRAINT customers_rounding_direction_check CHECK (rounding_direction IS NULL OR rounding_direction IN ('up', 'nearest'));
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_rounding_both_or_none_check;
ALTER TABLE customers ADD CONSTRAINT customers_rounding_both_or_none_check
  CHECK ((rounding_minutes IS NULL) = (rounding_direction IS NULL));
COMMIT;
