-- Settings: your own details, printed in the sender block of the PDF report. All three are empty (NULL) by default,
-- and a report without details looks as before. The address can have several lines.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS sender_name VARCHAR(100);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS sender_address VARCHAR(300);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS sender_email VARCHAR(254);
