const pool = require('../config/database');

// App-wide settings, stored in one row. Each option is a column of the settings table with a default there; a
// missing row means all defaults. There are no options yet, so a settings object is empty for now.
class Settings {
  static async get() {
    const result = await pool.query('SELECT * FROM settings WHERE id = 1');
    const { id, updated_at: updatedAt, ...options } = result.rows[0] ?? {};
    return options;
  }

  // Saves the given options (already validated by the controller) and returns all of them. There is nothing to
  // save yet, but the row is created, so the first option only has to add its column here.
  static async update(options) {
    await pool.query(
      `INSERT INTO settings (id) VALUES (1)
       ON CONFLICT (id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`
    );
    return Settings.get();
  }
}

module.exports = Settings;
