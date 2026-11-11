-- Settings: rounding of the hours of an entry in reports. rounding_minutes is the step (0 = no rounding, the default),
-- rounding_direction is 'up' (the default) or 'nearest'. show_rounding_note says whether reports name the rule in a
-- sentence (off by default). Stored entries are never changed.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS rounding_minutes SMALLINT NOT NULL DEFAULT 0
  CHECK (rounding_minutes IN (0, 15, 30));
ALTER TABLE settings ADD COLUMN IF NOT EXISTS rounding_direction VARCHAR(7) NOT NULL DEFAULT 'up'
  CHECK (rounding_direction IN ('up', 'nearest'));
ALTER TABLE settings ADD COLUMN IF NOT EXISTS show_rounding_note BOOLEAN NOT NULL DEFAULT false;
