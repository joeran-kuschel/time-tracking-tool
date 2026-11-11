-- Setting: whether reports show hourly rates and amounts by default (the Reports page starts from it). Off by default.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS show_amounts BOOLEAN NOT NULL DEFAULT false;
