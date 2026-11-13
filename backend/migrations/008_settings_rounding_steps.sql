-- Rounding steps of 5, 10 and 60 minutes next to 15 and 30 (#77). An install that applied the first version of 007 has
-- the check with the steps 0, 15 and 30: it is replaced. A fresh install already has this check from 007 and gets it
-- again, so the statements can run on any state. Both statements run in one transaction, so the table is never left
-- without the check. Needs 007 (the column).
BEGIN;
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_rounding_minutes_check;
ALTER TABLE settings ADD CONSTRAINT settings_rounding_minutes_check CHECK (rounding_minutes IN (0, 5, 10, 15, 30, 60));
COMMIT;
