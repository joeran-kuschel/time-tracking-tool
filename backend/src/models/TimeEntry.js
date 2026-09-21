const pool = require('../config/database');

class TimeEntry {
  static async create(projectId, startTime, endTime, description) {
    const result = await pool.query(
      'INSERT INTO time_entries (project_id, start_time, end_time, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [projectId, startTime, endTime, description || null]
    );
    return result.rows[0];
  }

  static async update(id, endTime, description) {
    const result = await pool.query(
      'UPDATE time_entries SET end_time = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [endTime, description || null, id]
    );
    return result.rows[0];
  }

  static async getById(id) {
    const result = await pool.query('SELECT * FROM time_entries WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async getByProjectId(projectId) {
    const result = await pool.query(
      'SELECT * FROM time_entries WHERE project_id = $1 ORDER BY start_time DESC',
      [projectId]
    );
    return result.rows;
  }

  static async getByCustomerIdAndMonth(customerId, year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const result = await pool.query(
      `SELECT te.*, p.name as project_name, p.hourly_rate, c.name as customer_name, c.id as customer_id
       FROM time_entries te
       JOIN projects p ON te.project_id = p.id
       JOIN customers c ON p.customer_id = c.id
       WHERE c.id = $1 AND te.start_time >= $2 AND te.start_time <= $3
       ORDER BY te.start_time DESC`,
      [customerId, startDate, endDate]
    );
    return result.rows;
  }

  static async delete(id) {
    const result = await pool.query('DELETE FROM time_entries WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
}

module.exports = TimeEntry;
