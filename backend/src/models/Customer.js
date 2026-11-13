const pool = require('../config/database');

class Customer {
  static async getAll() {
    const result = await pool.query('SELECT * FROM customers ORDER BY name ASC');
    return result.rows;
  }

  static async getById(id) {
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
    return result.rows[0];
  }

  // rounding: the customer's own rounding rule { minutes, direction }, or null/undefined to use the global setting
  static async create(name, email, rounding) {
    const result = await pool.query(
      'INSERT INTO customers (name, email, rounding_minutes, rounding_direction) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, rounding?.minutes ?? null, rounding?.direction ?? null]
    );
    return result.rows[0];
  }

  // rounding: undefined keeps the stored rule, null sets "use the global setting", { minutes, direction } sets an own rule
  static async update(id, name, email, rounding) {
    if (rounding === undefined) {
      const result = await pool.query(
        'UPDATE customers SET name = $1, email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
        [name, email, id]
      );
      return result.rows[0];
    }
    const result = await pool.query(
      `UPDATE customers SET name = $1, email = $2, rounding_minutes = $3, rounding_direction = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [name, email, rounding?.minutes ?? null, rounding?.direction ?? null, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pool.query('DELETE FROM customers WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
}

module.exports = Customer;
