-- Your logo for the sender block of the PDF report: one row (id is always 1), the image itself (PNG or JPEG, checked by
-- the backend before it is stored) and its type. It has its own table, not a column of settings, so that reading the
-- settings never loads the image. No row means no logo. The hourly backup includes the table.
CREATE TABLE IF NOT EXISTS sender_logo (
  id SMALLINT PRIMARY KEY DEFAULT 1 CONSTRAINT sender_logo_single_row CHECK (id = 1),
  content_type VARCHAR(10) NOT NULL CONSTRAINT sender_logo_type_check CHECK (content_type IN ('image/png', 'image/jpeg')),
  data BYTEA NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
