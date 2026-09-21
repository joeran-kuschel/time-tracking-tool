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

  static async create(name, email) {
    const result = await pool.query(
      'INSERT INTO customers (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]
    );
    return result.rows[0];
  }

  static async update(id, name, email) {
    const result = await pool.query(
      'UPDATE customers SET name = $1, email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [name, email, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pool.query('DELETE FROM customers WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
}

module.exports = Customer;
