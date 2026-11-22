const pool = require('../config/database');

// The next invoice number of each counter (the table invoice_counters; the scope is described in utils/invoiceNumber.js).
// A counter without a row is at 1.
class InvoiceCounter {
  static async next(scope) {
    const result = await pool.query('SELECT next_number FROM invoice_counters WHERE scope_year = $1', [scope]);
    return result.rows[0]?.next_number ?? 1;
  }

  // Takes the next number of a counter and moves it on, in one statement, so two takers never get the same number. `db`
  // is a pg client inside a transaction (the row stays locked until it ends, and a rollback gives the number back).
  static async take(db, scope) {
    const result = await db.query(
      `INSERT INTO invoice_counters (scope_year, next_number) VALUES ($1, 2)
       ON CONFLICT (scope_year) DO UPDATE SET next_number = invoice_counters.next_number + 1, updated_at = CURRENT_TIMESTAMP
       RETURNING next_number - 1 AS number`,
      [scope]
    );
    return result.rows[0].number;
  }

  // Raises the next number of a counter to `number`. Resolves to false, and changes nothing, when the counter is already
  // above `number`. The check and the write are one statement each (`WHERE next_number <= $2`), so two saves at the same
  // time cannot lower the counter again: whichever writes last only wins when its number is not lower. A year without a
  // row is inserted (an existing one is left alone), and the conditional update then decides: it also succeeds for the
  // row just inserted with this number.
  static async raise(scope, number) {
    const update = () => pool.query(
      `UPDATE invoice_counters SET next_number = $2, updated_at = CURRENT_TIMESTAMP
       WHERE scope_year = $1 AND next_number <= $2 RETURNING scope_year`,
      [scope, number]
    );
    if ((await update()).rows.length > 0) return true;
    await pool.query('INSERT INTO invoice_counters (scope_year, next_number) VALUES ($1, $2) ON CONFLICT (scope_year) DO NOTHING', [scope, number]);
    return (await update()).rows.length > 0;
  }
}

module.exports = InvoiceCounter;
