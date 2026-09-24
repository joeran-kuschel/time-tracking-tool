const pool = require('../config/database');

const STATUSES = ['draft', 'ready', 'sent'];

// Status of a customer's monthly report: draft, ready or sent. A month without a stored status is a draft.
class ReportStatus {
  static async get(customerId, year, month) {
    const result = await pool.query(
      'SELECT status FROM report_status WHERE customer_id = $1 AND year = $2 AND month = $3',
      [customerId, year, month]
    );
    return result.rows[0]?.status ?? 'draft';
  }

  static async set(customerId, year, month, status) {
    const result = await pool.query(
      `INSERT INTO report_status (customer_id, year, month, status) VALUES ($1, $2, $3, $4)
       ON CONFLICT (customer_id, year, month)
       DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
       RETURNING customer_id, year, month, status`,
      [customerId, year, month, status]
    );
    return result.rows[0];
  }

  // Every customer with time entries in the month, with the status of its report, ordered by name
  static async forMonth(year, month) {
    const result = await pool.query(
      `SELECT DISTINCT c.id AS customer_id, c.name AS customer_name, COALESCE(rs.status, 'draft') AS status
       FROM customers c
       JOIN projects p ON p.customer_id = c.id
       JOIN time_entries te ON te.project_id = p.id
       LEFT JOIN report_status rs ON rs.customer_id = c.id AND rs.year = $1 AND rs.month = $2
       WHERE te.start_time >= $3 AND te.start_time < $4
       ORDER BY customer_name`,
      [year, month, new Date(year, month - 1, 1), new Date(year, month, 1)]
    );
    return result.rows;
  }
}

ReportStatus.STATUSES = STATUSES;

module.exports = ReportStatus;
