-- Settings: the hourly rate a new project starts with, in euros. NULL (the default) means no default rate. It is only
-- read when the form for a new project opens; existing projects and report amounts never change with it.
-- The check is added separately (and replaced when the migration runs again) so that it can run twice.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS default_hourly_rate DECIMAL(10, 2);
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_default_hourly_rate_check;
ALTER TABLE settings ADD CONSTRAINT settings_default_hourly_rate_check CHECK (default_hourly_rate >= 0);
