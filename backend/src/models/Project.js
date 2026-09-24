const pool = require('../config/database');

class Project {
  static async getByCustomerId(customerId) {
    const result = await pool.query(
      'SELECT * FROM projects WHERE customer_id = $1 ORDER BY name ASC',
      [customerId]
    );
    return result.rows;
  }

  // All projects with their customer's name, ordered by customer, then project
  static async getAllWithCustomer() {
    const result = await pool.query(
      `SELECT p.*, c.name as customer_name
       FROM projects p
       JOIN customers c ON p.customer_id = c.id
       ORDER BY c.name, p.name`
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

  // Leaving out the hourly rate keeps the stored one
  static async update(id, name, hourlyRate) {
    const result = await pool.query(
      'UPDATE projects SET name = $1, hourly_rate = COALESCE($2::numeric, hourly_rate), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [name, hourlyRate ?? null, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
}

module.exports = Project;
