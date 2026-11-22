-- Invoices (#114). An invoice is a record that never changes after it is created: it keeps a copy of your details, the
-- customer's details, the VAT, the lines and the totals, and the PDF that was made, so later changes to the settings,
-- the customer, the entries or the rates do not alter it. Amounts are whole cents (EUR only).
-- customer_id is set to NULL when the customer is deleted: the invoice stays, with the customer's name and address as
-- they were. The number is unique (the counters in invoice_counters are in 015), so a number is never used twice.
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  number VARCHAR(60) NOT NULL CONSTRAINT invoices_number_key UNIQUE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  invoice_date DATE NOT NULL,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  language VARCHAR(2) NOT NULL CONSTRAINT invoices_language_check CHECK (language IN ('de', 'en')),
  customer_name VARCHAR(255) NOT NULL,
  customer_address VARCHAR(300) NOT NULL,
  customer_tax_id VARCHAR(30),
  sender_name VARCHAR(100) NOT NULL,
  sender_address VARCHAR(300) NOT NULL,
  sender_email VARCHAR(254),
  sender_tax_id VARCHAR(30) NOT NULL,
  sender_bank_details VARCHAR(300),
  vat_mode VARCHAR(14) NOT NULL CONSTRAINT invoices_vat_mode_check CHECK (vat_mode IN ('regular', 'small_business')),
  vat_rate SMALLINT NOT NULL CONSTRAINT invoices_vat_rate_check CHECK (vat_rate IN (0, 7, 19)),
  net_cents INTEGER NOT NULL CONSTRAINT invoices_net_check CHECK (net_cents >= 0),
  vat_cents INTEGER NOT NULL CONSTRAINT invoices_vat_check CHECK (vat_cents >= 0),
  gross_cents INTEGER NOT NULL CONSTRAINT invoices_gross_check CHECK (gross_cents >= 0),
  pdf BYTEA NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- The lines of an invoice, one per project, in the order they are printed
CREATE TABLE IF NOT EXISTS invoice_lines (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL,
  description VARCHAR(255) NOT NULL,
  minutes INTEGER NOT NULL CONSTRAINT invoice_lines_minutes_check CHECK (minutes >= 0),
  rate_cents INTEGER NOT NULL CONSTRAINT invoice_lines_rate_check CHECK (rate_cents >= 0),
  amount_cents INTEGER NOT NULL CONSTRAINT invoice_lines_amount_check CHECK (amount_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
