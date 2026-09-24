-- Status of a customer's monthly report. A missing row means draft.
CREATE TABLE IF NOT EXISTS report_status (
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  status VARCHAR(10) NOT NULL CHECK (status IN ('draft', 'ready', 'sent')),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id, year, month)
);
