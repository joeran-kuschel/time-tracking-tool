-- Details that an invoice needs (#114). A customer's address (up to 6 lines, separated by line breaks) and tax ID, and your
-- own bank details (up to 4 lines) for the invoice. All are empty (NULL) by default, so nothing changes for existing data.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address VARCHAR(300);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_id VARCHAR(30);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS sender_bank_details VARCHAR(300);
