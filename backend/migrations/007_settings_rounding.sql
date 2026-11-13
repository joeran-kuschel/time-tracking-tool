-- Settings: rounding of the hours of an entry in reports. rounding_minutes is the step (0 = no rounding, the default),
-- rounding_direction is 'up' (the default) or 'nearest'. show_rounding_note says whether reports name the rule in a
-- sentence (off by default). Stored entries are never changed.
-- The checks have explicit names so a later migration can replace them. 007 first allowed the steps 0, 15 and 30; a fresh
-- install gets the steps of 008 (0, 5, 10, 15, 30, 60) right away, and 008 brings an install that applied the first
-- version to the same state.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS rounding_minutes SMALLINT NOT NULL DEFAULT 0
  CONSTRAINT settings_rounding_minutes_check CHECK (rounding_minutes IN (0, 5, 10, 15, 30, 60));
ALTER TABLE settings ADD COLUMN IF NOT EXISTS rounding_direction VARCHAR(7) NOT NULL DEFAULT 'up'
  CONSTRAINT settings_rounding_direction_check CHECK (rounding_direction IN ('up', 'nearest'));
ALTER TABLE settings ADD COLUMN IF NOT EXISTS show_rounding_note BOOLEAN NOT NULL DEFAULT false;
