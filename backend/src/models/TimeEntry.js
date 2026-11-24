const pool = require('../config/database');
const { taskKey } = require('../utils/tasks');

// Entries with their project, hourly rate and customer, for reports and the dashboard
const PROJECT_AND_CUSTOMER_JOINS = `FROM time_entries te
       JOIN projects p ON te.project_id = p.id
       JOIN customers c ON p.customer_id = c.id`;
// customer_rounding_*: the customer's own rounding rule (both null: use the global setting), see utils/rounding.js
const CUSTOMER_ROUNDING = 'c.rounding_minutes AS customer_rounding_minutes, c.rounding_direction AS customer_rounding_direction';
const WITH_PROJECT_AND_CUSTOMER = `SELECT te.*, p.name as project_name, p.hourly_rate, c.name as customer_name, c.id as customer_id, ${CUSTOMER_ROUNDING}
       ${PROJECT_AND_CUSTOMER_JOINS}`;

// Whitelist of the sort orders of the search; the id breaks ties so that pages never overlap
const SEARCH_ORDER = {
  newest: 'te.start_time DESC, te.id DESC',
  oldest: 'te.start_time ASC, te.id ASC',
};

// The WHERE clause and its parameters for a search filter. User input only ever goes into the parameters.
function searchWhere({ q, customerId, projectId, from, to }) {
  const params = [];
  const conditions = [];
  const add = (condition, value) => {
    params.push(value);
    conditions.push(condition.replaceAll('?', `$${params.length}`));
  };
  // strpos matches the text literally, so %, _ and \ in it need no escaping (unlike LIKE)
  if (q) add('(strpos(lower(te.description), lower(?)) > 0 OR strpos(lower(te.task), lower(?)) > 0)', q);
  if (customerId) add('c.id = ?', customerId);
  if (projectId) add('p.id = ?', projectId);
  if (from) add('te.start_time >= ?', from);
  if (to) add('te.start_time < ?', to);
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

class TimeEntry {
  // task: the shared name of an activity (utils/tasks.js), already trimmed; undefined or null for none
  static async create(projectId, startTime, endTime, description, task) {
    const result = await pool.query(
      'INSERT INTO time_entries (project_id, start_time, end_time, description, task) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [projectId, startTime, endTime, description || null, task || null]
    );
    return result.rows[0];
  }

  // Fields left out keep their stored value; for the description and the task, '' or null clears it.
  static async update(id, { startTime, endTime, projectId, description, task }) {
    const result = await pool.query(
      `UPDATE time_entries
       SET start_time = COALESCE($1::timestamp, start_time),
           end_time = $2,
           project_id = COALESCE($3::integer, project_id),
           description = CASE WHEN $4::boolean THEN $5 ELSE description END,
           task = CASE WHEN $6::boolean THEN $7 ELSE task END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [startTime ?? null, endTime, projectId ?? null, description !== undefined, description || null, task !== undefined, task || null, id]
    );
    return result.rows[0];
  }

  // Reopens a finished entry: it runs again, with its start and description unchanged, so the time since its end
  // counts as work time. Answers the entry, or undefined when it is unknown or already running. The one_running_timer
  // index refuses it (code 23505) while another timer runs.
  static async resume(id) {
    const result = await pool.query(
      `UPDATE time_entries SET end_time = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND end_time IS NOT NULL RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  // The tasks used in a project, the most recently worked on first, each once (ignoring case and surrounding spaces, the
  // way reports compare them; the spelling of the latest entry), for the suggestions of the Task field
  static async getTasks(projectId, limit = 50) {
    const result = await pool.query(
      `SELECT task FROM time_entries WHERE project_id = $1 AND task IS NOT NULL
       GROUP BY task ORDER BY MAX(start_time) DESC LIMIT $2`,
      [projectId, limit * 4]
    );
    const seen = new Set();
    return result.rows
      .map((row) => row.task)
      .filter((task) => !seen.has(taskKey(task)) && seen.add(taskKey(task)))
      .slice(0, limit);
  }

  // The entries with these ids as { id, end_time } (an unknown id is not in the answer)
  static async getStates(ids) {
    const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
    const result = await pool.query(`SELECT id, end_time FROM time_entries WHERE id IN (${placeholders})`, ids);
    return result.rows;
  }

  // Sets the task of finished entries in one statement ('' or null clears it); nothing else changes. Answers the number of
  // entries changed. The running entry is left out, so a timer that was started after the caller checked is not touched.
  static async setTask(ids, task) {
    const placeholders = ids.map((_, index) => `$${index + 2}`).join(', ');
    const result = await pool.query(
      `UPDATE time_entries SET task = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id IN (${placeholders}) AND end_time IS NOT NULL`,
      [task || null, ...ids]
    );
    return result.rowCount;
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

  // All entries of a customer's projects with the project name, its hourly rate and the customer's rounding rule,
  // grouped by project name, newest first
  static async getByCustomerId(customerId) {
    const result = await pool.query(
      `SELECT te.*, p.name as project_name, p.hourly_rate, ${CUSTOMER_ROUNDING}
       FROM time_entries te
       JOIN projects p ON te.project_id = p.id
       JOIN customers c ON p.customer_id = c.id
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

  // A customer's entries that start in [from, to) (ISO strings, see monthRange in utils/period.js), newest first
  static async getByCustomerIdInRange(customerId, { from, to }) {
    const result = await pool.query(
      `${WITH_PROJECT_AND_CUSTOMER}
       WHERE c.id = $1 AND te.start_time >= $2 AND te.start_time < $3
       ORDER BY te.start_time DESC`,
      [customerId, from, to]
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

  // Entries of all customers matching the filter (see parseEntryFilter in utils/entryFilter.js: q, customerId,
  // projectId, from/to as ISO instants with from <= start_time < to, sort), running ones included.
  // limit null returns all rows. total counts all matches, hours sums the finished ones, each rounded to whole minutes first (half up), so the
  // total is what the shown rows add up to.
  static async search(filter, { limit = null, offset = 0 } = {}) {
    const { where, params } = searchWhere(filter);
    const order = SEARCH_ORDER[filter.sort] || SEARCH_ORDER.newest;
    const [entries, totals] = await Promise.all([
      pool.query(
        `${WITH_PROJECT_AND_CUSTOMER}
         ${where}
         ORDER BY ${order}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COALESCE(SUM(CASE WHEN te.end_time IS NOT NULL
                  THEN ROUND((EXTRACT(EPOCH FROM te.end_time) - EXTRACT(EPOCH FROM te.start_time))::numeric / 60) ELSE 0 END), 0) / 60 AS hours
         ${PROJECT_AND_CUSTOMER_JOINS}
         ${where}`,
        params
      ),
    ]);
    return { entries: entries.rows, total: totals.rows[0].total, hours: Number(totals.rows[0].hours) };
  }

  static async delete(id) {
    const result = await pool.query('DELETE FROM time_entries WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
}

module.exports = TimeEntry;
