-- App-wide settings: one row (id is always 1), one typed column per option. The row is created on the first
-- read (models/Settings.js), so every option has its default until it is saved. There are no options yet; each one adds a
-- column with a default.
CREATE TABLE IF NOT EXISTS settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
