const pool = require('../config/database');

// Entries with their project, hourly rate and customer, for reports and the dashboard
const WITH_PROJECT_AND_CUSTOMER = `SELECT te.*, p.name as project_name, p.hourly_rate, c.name as customer_name, c.id as customer_id
       FROM time_entries te
       JOIN projects p ON te.project_id = p.id
       JOIN customers c ON p.customer_id = c.id`;

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

  // All entries of a customer's projects with the project name, grouped by project name, newest first
  static async getByCustomerId(customerId) {
    const result = await pool.query(
      `SELECT te.*, p.name as project_name
       FROM time_entries te
       JOIN projects p ON te.project_id = p.id
       WHERE p.customer_id = $1
       ORDER BY p.name, te.start_time DESC`,
      [customerId]
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
      `${WITH_PROJECT_AND_CUSTOMER}
       WHERE c.id = $1 AND te.start_time >= $2 AND te.start_time <= $3
       ORDER BY te.start_time DESC`,
      [customerId, startDate, endDate]
    );
    return result.rows;
  }

  // Entries of all customers that start in [from, to), running ones included, oldest first
  static async getInRange(from, to) {
    const result = await pool.query(
      `${WITH_PROJECT_AND_CUSTOMER}
       WHERE te.start_time >= $1 AND te.start_time < $2
       ORDER BY te.start_time`,
      [from, to]
    );
    return result.rows;
  }

  // The latest finished entries of all customers, newest first
  static async getRecent(limit) {
    const result = await pool.query(
      `${WITH_PROJECT_AND_CUSTOMER}
       WHERE te.end_time IS NOT NULL
       ORDER BY te.start_time DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  static async delete(id) {
    const result = await pool.query('DELETE FROM time_entries WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
}

module.exports = TimeEntry;
