const pool = require('../config/database');
const OPTIONS = require('../config/settingsOptions');
const InvoiceCounter = require('./InvoiceCounter');
const { counterScope } = require('../utils/invoiceNumber');

// The columns of the settings table behind the options; the counter of the invoice numbers (`counter: true`) is stored apart
const COLUMN_OPTIONS = Object.entries(OPTIONS).filter(([, option]) => option.column);

// App-wide settings, stored in one row. Each option (config/settingsOptions.js) is a column of the settings table with
// a default there, and the row is created on the first read, so an option has its default until it is saved.
class Settings {
  // { name: value } for every option; `now` decides which year's invoice counter is shown
  static async get(now = new Date()) {
    await pool.query('INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
    const result = await pool.query('SELECT * FROM settings WHERE id = 1');
    const row = result.rows[0];
    const values = Object.fromEntries(
      COLUMN_OPTIONS.map(([name, { column, fromColumn }]) => [name, fromColumn ? fromColumn(row[column]) : row[column]])
    );
    values.invoiceNextNumber = await InvoiceCounter.next(counterScope(values.invoiceNumberPattern, now));
    return values;
  }

  // Saves the given options ({ name: value }, already validated by the controller) and returns all options. Only names of
  // OPTIONS reach the SQL, and its columns come from there, never from the caller. The invoice counter is raised first,
  // for the counter of the pattern that is saved with it, in one conditional statement (InvoiceCounter.raise). A number
  // below the current one is refused (an error with code COUNTER_LOWERED) before anything else is saved, so numbers are
  // never used twice. If saving the columns then fails, the counter stays raised, which only skips numbers.
  static async update(options, now = new Date()) {
    const changes = Object.entries(options ?? {}).filter(([name]) => OPTIONS[name]?.column);
    const wanted = options?.invoiceNextNumber;
    await pool.query('INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
    if (wanted !== undefined) {
      const pattern = options.invoiceNumberPattern ?? (await Settings.get(now)).invoiceNumberPattern;
      if (!(await InvoiceCounter.raise(counterScope(pattern, now), wanted))) {
        throw Object.assign(new Error('The next invoice number cannot be lowered'), { code: 'COUNTER_LOWERED' });
      }
    }
    const assignments = changes.map(([name], index) => `${OPTIONS[name].column} = $${index + 1}`);
    await pool.query(
      `UPDATE settings SET ${[...assignments, 'updated_at = CURRENT_TIMESTAMP'].join(', ')} WHERE id = 1`,
      changes.map(([, value]) => value)
    );
    return Settings.get(now);
  }
}

module.exports = Settings;
