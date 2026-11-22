-- Settings: the first day of the week, 'monday' (the default) or 'sunday'. The Dashboard and the Entries filters start
-- their weeks on this day. Months and reports stay calendar months. Stored entries never change.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS week_start VARCHAR(6) NOT NULL DEFAULT 'monday'
  CONSTRAINT settings_week_start_check CHECK (week_start IN ('monday', 'sunday'));
