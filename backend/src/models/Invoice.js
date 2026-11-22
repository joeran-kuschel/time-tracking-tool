const pool = require('../config/database');
const InvoiceCounter = require('./InvoiceCounter');
const { counterScope, formatInvoiceNumber } = require('../utils/invoiceNumber');

// The columns of an invoice without its PDF, with the dates as 'YYYY-MM-DD' text, for the list and the answer of a new invoice
const SUMMARY = `id, number, customer_id, to_char(invoice_date, 'YYYY-MM-DD') AS invoice_date,
  to_char(period_from, 'YYYY-MM-DD') AS period_from, to_char(period_to, 'YYYY-MM-DD') AS period_to, language, customer_name,
  vat_mode, vat_rate, net_cents, vat_cents, gross_cents, created_at`;

// Runs fn(client) in one transaction on its own connection: committed when fn resolves, rolled back when it throws
async function inTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Stores the invoice row with its copies and the PDF, and returns its id. A number that another invoice already has is an
// error with code NUMBER_TAKEN.
async function insertInvoice(db, number, data, pdf) {
  try {
    const result = await db.query(
      `INSERT INTO invoices (number, customer_id, invoice_date, period_from, period_to, language, customer_name, customer_address,
         customer_tax_id, sender_name, sender_address, sender_email, sender_tax_id, sender_bank_details, vat_mode, vat_rate,
         net_cents, vat_cents, gross_cents, pdf)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING id`,
      [number, data.customerId, data.invoiceDate, data.periodFrom, data.periodTo, data.language, data.customer.name,
        data.customer.address, data.customer.taxId ?? null, data.sender.name, data.sender.address, data.sender.email ?? null,
        data.sender.taxId, data.sender.bankDetails ?? null, data.vatMode, data.vatRate, data.netCents, data.vatCents,
        data.grossCents, pdf]
    );
    return result.rows[0].id;
  } catch (err) {
    // The number is the only unique column that the insert fills (the id comes from a sequence)
    if (err.code === '23505') {
      throw Object.assign(new Error(`The invoice number ${number} is already used`), { code: 'NUMBER_TAKEN', number });
    }
    throw err;
  }
}

async function insertLines(db, invoiceId, lines) {
  for (const [index, line] of lines.entries()) {
    await db.query(
      'INSERT INTO invoice_lines (invoice_id, position, description, minutes, rate_cents, amount_cents) VALUES ($1, $2, $3, $4, $5, $6)',
      [invoiceId, index + 1, line.name, line.minutes, line.rateCents, line.cents]
    );
  }
}

// Invoices. They are only created and deleted, never changed (see migration 017).
class Invoice {
  // Creates an invoice and returns its summary. `data`: { pattern (the number pattern), customerId, invoiceDate and
  // periodFrom/periodTo ('YYYY-MM-DD'), language, customer { name, address, taxId }, sender { name, address, email, taxId,
  // bankDetails }, vatMode, vatRate, lines [{ name, minutes, rateCents, cents }], netCents, vatCents, grossCents }.
  // `render(number)` makes the PDF (a Buffer) once the number is known. All in one transaction: the number is taken from
  // the counter of the invoice date's year, the PDF is made, and the invoice and its lines are stored. If anything fails,
  // nothing is stored and the number is not used up. An error with code NUMBER_TAKEN means that a number the pattern makes is
  // already used by another invoice (for example after the pattern was changed).
  static async create(data, render) {
    return inTransaction(async (db) => {
      const date = new Date(`${data.invoiceDate}T00:00:00Z`);
      const counter = await InvoiceCounter.take(db, counterScope(data.pattern, date));
      const number = formatInvoiceNumber(data.pattern, counter, date);
      const id = await insertInvoice(db, number, data, await render(number));
      await insertLines(db, id, data.lines);
      return (await db.query(`SELECT ${SUMMARY} FROM invoices WHERE id = $1`, [id])).rows[0];
    });
  }

  // All invoices without their PDFs, newest first
  static async getAll() {
    const result = await pool.query(`SELECT ${SUMMARY} FROM invoices ORDER BY invoice_date DESC, id DESC`);
    return result.rows;
  }

  // { number, pdf } of an invoice, or undefined
  static async getPdf(id) {
    const result = await pool.query('SELECT number, pdf FROM invoices WHERE id = $1', [id]);
    return result.rows[0];
  }

  // Deletes an invoice and its lines; resolves to its number, or undefined when there is none. The counter is not touched,
  // so the number stays used.
  static async delete(id) {
    const result = await pool.query('DELETE FROM invoices WHERE id = $1 RETURNING number', [id]);
    return result.rows[0]?.number;
  }
}

module.exports = Invoice;
