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
  // reportLanguage: 'de' or 'en' for reports always in that language, or null/undefined for the language of the app
  // invoiceDetails: { address, taxId } for invoices, each null/undefined when not set
  static async create(name, email, rounding, reportLanguage, invoiceDetails) {
    const result = await pool.query(
      `INSERT INTO customers (name, email, rounding_minutes, rounding_direction, report_language, address, tax_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, email, rounding?.minutes ?? null, rounding?.direction ?? null, reportLanguage ?? null, invoiceDetails?.address ?? null, invoiceDetails?.taxId ?? null]
    );
    return result.rows[0];
  }

  // rounding: undefined keeps the stored rule, null sets "use the global setting", { minutes, direction } sets an own rule
  // reportLanguage: undefined keeps the stored language, null sets "the language of the app", 'de' or 'en' sets it
  // invoiceDetails: { address, taxId }; a field that is undefined keeps the stored value, null removes it
  static async update(id, name, email, rounding, reportLanguage, invoiceDetails) {
    // Only what is given is changed. The column names are fixed here; the values are parameters.
    const assignments = ['name = $1', 'email = $2'];
    const values = [name, email];
    if (rounding !== undefined) {
      assignments.push(`rounding_minutes = $${values.length + 1}`, `rounding_direction = $${values.length + 2}`);
      values.push(rounding?.minutes ?? null, rounding?.direction ?? null);
    }
    if (reportLanguage !== undefined) {
      assignments.push(`report_language = $${values.length + 1}`);
      values.push(reportLanguage);
    }
    for (const [key, column] of [['address', 'address'], ['taxId', 'tax_id']]) {
      if (invoiceDetails?.[key] !== undefined) {
        assignments.push(`${column} = $${values.length + 1}`);
        values.push(invoiceDetails[key]);
      }
    }
    const result = await pool.query(
      `UPDATE customers SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length + 1} RETURNING *`,
      [...values, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await pool.query('DELETE FROM customers WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  }
}

module.exports = Customer;
