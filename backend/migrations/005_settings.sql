-- App-wide settings: one row (id is always 1), one typed column per option. A missing row means every option has
-- its default (models/Settings.js). There are no options yet; each one adds a column with a default.
CREATE TABLE IF NOT EXISTS settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
