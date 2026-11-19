-- Customers: the language of their PDF and CSV reports (#82). NULL (every existing customer) means the language of the
-- app at download time, as before; 'de' or 'en' makes the customer's reports always come out in that language.
-- The list of languages is LOCALES in backend/src/i18n.js; a migration that adds one replaces the check. The check has an
-- explicit name, allows NULL explicitly, and is added separately (replaced when the migration runs again), so that the
-- migration can run twice and pg-mem, the test database, accepts it.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS report_language VARCHAR(2);
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_report_language_check;
ALTER TABLE customers ADD CONSTRAINT customers_report_language_check
  CHECK (report_language IS NULL OR report_language IN ('de', 'en'));
