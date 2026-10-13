const pool = require('../config/database');

const DAY = 24 * 60 * 60 * 1000;
// A session ends after 14 days without a request, and after 30 days in any case
const IDLE_TIME = 14 * DAY;
const MAX_AGE = 30 * DAY;
// The idle expiry is moved forward at most once per hour, not with every request
const EXTEND_AFTER = 60 * 60 * 1000;

class Session {
  static async create(userId, tokenHash, now = new Date()) {
    await pool.query(
      'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)',
      [tokenHash, userId, now, new Date(now.getTime() + IDLE_TIME)]
    );
  }

  // The user of a valid session, or undefined; a used session lives on
  static async findUser(tokenHash, now = new Date()) {
    const result = await pool.query(
      `SELECT u.id, u.email, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > $2 AND s.created_at > $3`,
      [tokenHash, now, new Date(now.getTime() - MAX_AGE)]
    );
    const user = result.rows[0];
    if (!user) return undefined;

    const extended = new Date(now.getTime() + IDLE_TIME);
    if (new Date(user.expires_at).getTime() < extended.getTime() - EXTEND_AFTER) {
      await pool.query('UPDATE sessions SET expires_at = $2 WHERE token_hash = $1', [tokenHash, extended]);
    }
    return { id: user.id, email: user.email };
  }

  static async remove(tokenHash) {
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  }

  static async removeAllOfUser(userId) {
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }

  static async removeExpired(now = new Date()) {
    await pool.query('DELETE FROM sessions WHERE expires_at <= $1 OR created_at <= $2', [
      now,
      new Date(now.getTime() - MAX_AGE),
    ]);
  }
}

Session.IDLE_TIME = IDLE_TIME;
Session.MAX_AGE = MAX_AGE;

module.exports = Session;
