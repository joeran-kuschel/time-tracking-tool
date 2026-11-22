-- Settings for invoices: VAT ('regular' with a rate of 19, 7 or 0 percent, or 'small_business' under §19 UStG, which
-- charges none), your own tax ID (NULL = not set), and the pattern of the invoice numbers with {YYYY}, {YY}, {MM} and one
-- counter such as {NNNN} (checked by the backend, see utils/invoiceNumber.js). Nothing uses them until invoices exist.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS vat_mode VARCHAR(14) NOT NULL DEFAULT 'regular'
  CONSTRAINT settings_vat_mode_check CHECK (vat_mode IN ('regular', 'small_business'));
ALTER TABLE settings ADD COLUMN IF NOT EXISTS vat_rate SMALLINT NOT NULL DEFAULT 19
  CONSTRAINT settings_vat_rate_check CHECK (vat_rate IN (0, 7, 19));
ALTER TABLE settings ADD COLUMN IF NOT EXISTS sender_tax_id VARCHAR(30);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS invoice_number_pattern VARCHAR(40) NOT NULL DEFAULT '{YYYY}-{NNNN}';

-- The next invoice number per counter. scope_year is the year a counter belongs to, or 0 for a pattern without a year,
-- which keeps counting. A year without a row starts at 1. Numbers are only ever raised.
CREATE TABLE IF NOT EXISTS invoice_counters (
  scope_year SMALLINT PRIMARY KEY CONSTRAINT invoice_counters_year_check CHECK (scope_year = 0 OR scope_year BETWEEN 1000 AND 9999),
  next_number INTEGER NOT NULL DEFAULT 1 CONSTRAINT invoice_counters_number_check CHECK (next_number BETWEEN 1 AND 99999999),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
