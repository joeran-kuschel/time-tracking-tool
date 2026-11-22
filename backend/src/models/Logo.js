const pool = require('../config/database');

// Your logo for the PDF report, stored as one row (migration 014). The image was checked before it got here
// (utils/logoImage.js).
class Logo {
  // { contentType, data (a Buffer) }, or null when there is no logo
  static async get() {
    const result = await pool.query('SELECT content_type, data FROM sender_logo WHERE id = 1');
    const row = result.rows[0];
    return row ? { contentType: row.content_type, data: row.data } : null;
  }

  // Stores the logo, replacing the one that was there
  static async set(contentType, data) {
    await pool.query(
      `INSERT INTO sender_logo (id, content_type, data) VALUES (1, $1, $2)
       ON CONFLICT (id) DO UPDATE SET content_type = EXCLUDED.content_type, data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
      [contentType, data]
    );
  }

  // Removes the logo; nothing happens when there is none
  static async remove() {
    await pool.query('DELETE FROM sender_logo WHERE id = 1');
  }
}

module.exports = Logo;
