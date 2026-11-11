const pool = require('../config/database');
const OPTIONS = require('../config/settingsOptions');

// App-wide settings, stored in one row. Each option (config/settingsOptions.js) is a column of the settings table with
// a default there, and the row is created on the first read, so an option has its default until it is saved.
class Settings {
  // { name: value } for every option
  static async get() {
    await pool.query('INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
    const result = await pool.query('SELECT * FROM settings WHERE id = 1');
    const row = result.rows[0];
    return Object.fromEntries(Object.entries(OPTIONS).map(([name, { column }]) => [name, row[column]]));
  }

  // Saves the given options ({ name: value }, already validated by the controller) in one statement and returns all
  // options. Only names of OPTIONS reach the SQL, and its columns come from there, never from the caller.
  static async update(options) {
    const changes = Object.entries(options ?? {}).filter(([name]) => Object.hasOwn(OPTIONS, name));
    await pool.query('INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
    const assignments = changes.map(([name], index) => `${OPTIONS[name].column} = $${index + 1}`);
    await pool.query(
      `UPDATE settings SET ${[...assignments, 'updated_at = CURRENT_TIMESTAMP'].join(', ')} WHERE id = 1`,
      changes.map(([, value]) => value)
    );
    return Settings.get();
  }
}

module.exports = Settings;
