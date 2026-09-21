const pool = require('../config/database');

class Project {
  static async getByCustomerId(customerId) {
    const result = await pool.query(
      'SELECT * FROM projects WHERE customer_id = $1 ORDER BY name ASC',
      [customerId]
    );
    return result.rows;
  }

  static async getById(id) {
    const result = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async create(customerId, name, hourlyRate) {
    const result = await pool.query(
      'INSERT INTO projects (customer_id, name, hourly_rate) VALUES ($1, $2, $3) RETURNING *',
      [customerId, name, hourlyRate || 0]
    );
    return result.rows[0];
  }

  static async update(id, name, hourlyRate) {
    const result = await pool.query(
      'UPDATE projects SET name = $1, hourly_rate = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [name, hourlyRate, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
}

module.exports = Project;
