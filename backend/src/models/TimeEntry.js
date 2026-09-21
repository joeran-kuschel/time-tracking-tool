const pool = require('../config/database');

class TimeEntry {
  static async create(projectId, startTime, endTime, description) {
    const result = await pool.query(
      'INSERT INTO time_entries (project_id, start_time, end_time, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [projectId, startTime, endTime, description || null]
    );
    return result.rows[0];
  }

  // Fields left out keep their stored value; for the description, '' or null clears it.
  static async update(id, { startTime, endTime, projectId, description }) {
    const result = await pool.query(
      `UPDATE time_entries
       SET start_time = COALESCE($1::timestamp, start_time),
           end_time = $2,
           project_id = COALESCE($3::integer, project_id),
           description = CASE WHEN $4::boolean THEN $5 ELSE description END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [startTime ?? null, endTime, projectId ?? null, description !== undefined, description || null, id]
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

  // The running entry (no end_time) with its project and customer, or undefined
  static async getActive() {
    const result = await pool.query(
      `SELECT te.*, p.name as project_name, c.id as customer_id, c.name as customer_name
       FROM time_entries te
       JOIN projects p ON te.project_id = p.id
       JOIN customers c ON p.customer_id = c.id
       WHERE te.end_time IS NULL
       ORDER BY te.start_time DESC
       LIMIT 1`
    );
    return result.rows[0];
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
