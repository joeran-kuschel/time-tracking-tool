const pool = require('../config/database');

// The single user of the tool. Emails are compared in lower case.
class User {
  static async findByEmail(email) {
    const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [
      email.toLowerCase(),
    ]);
    return result.rows[0];
  }

  // Creates the user, or replaces the password of the existing one
  static async save(email, passwordHash) {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id, email`,
      [email.toLowerCase(), passwordHash]
    );
    return result.rows[0];
  }
}

module.exports = User;
