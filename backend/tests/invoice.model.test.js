const fs = require('fs');
const path = require('path');
const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
  connect: (...args) => mockPool.connect(...args),
}));

const Invoice = require('../src/models/Invoice');
const InvoiceCounter = require('../src/models/InvoiceCounter');
const Customer = require('../src/models/Customer');

const migration = fs.readFileSync(path.join(__dirname, '..', 'migrations', '017_invoices.sql'), 'utf8');

// The bytes of the PDF are plain text here: the test database (pg-mem) corrupts bytes from 0x80 on in a BYTEA column,
// which a real PDF has. The binary round trip is checked against a real Postgres (documentation/backend/invoices.md).
const PDF = (number) => Buffer.from(`%PDF-test ${number}`);

const data = (overrides = {}) => ({
  pattern: '{YYYY}-{NNNN}',
  customerId: null,
  invoiceDate: '2026-03-05',
  periodFrom: '2026-02-01',
  periodTo: '2026-02-28',
  language: 'de',
  customer: { name: 'Muster GmbH', address: 'Musterweg 1\n12345 Musterstadt', taxId: 'DE999' },
  sender: { name: 'Jana Beispiel', address: 'Weg 5', email: 'jana@example.test', taxId: '12/345', bankDetails: 'DE89 3704' },
  vatMode: 'regular',
  vatRate: 19,
  lines: [{ name: 'Website', minutes: 750, rateCents: 8000, cents: 100000 }, { name: 'Beratung', minutes: 90, rateCents: 9500, cents: 14250 }],
  netCents: 114250,
  vatCents: 21708,
  grossCents: 135958,
  ...overrides,
});

describe('Invoice', () => {
  beforeEach(() => {
    mockPool = createTestPool();
  });

  const lineRows = async () => (await mockPool.query('SELECT * FROM invoice_lines ORDER BY invoice_id, position')).rows;

  describe('create', () => {
    test('takes number 1 of the year, makes the PDF with it, and stores the invoice with a copy of its details', async () => {
      const render = jest.fn(async (number) => PDF(number));

      const invoice = await Invoice.create(data(), render);

      expect(render).toHaveBeenCalledWith('2026-0001');
      expect(invoice).toMatchObject({
        number: '2026-0001', invoice_date: '2026-03-05', period_from: '2026-02-01', period_to: '2026-02-28', language: 'de',
        customer_name: 'Muster GmbH', vat_mode: 'regular', vat_rate: 19, net_cents: 114250, vat_cents: 21708, gross_cents: 135958,
      });
      const [row] = (await mockPool.query('SELECT * FROM invoices')).rows;
      expect(row).toMatchObject({
        customer_address: 'Musterweg 1\n12345 Musterstadt', customer_tax_id: 'DE999', sender_name: 'Jana Beispiel', sender_address: 'Weg 5',
        sender_email: 'jana@example.test', sender_tax_id: '12/345', sender_bank_details: 'DE89 3704',
      });
      expect(row.pdf.toString()).toBe('%PDF-test 2026-0001');
    });

    test('stores the lines in order, with their position', async () => {
      await Invoice.create(data(), async (number) => PDF(number));

      expect((await lineRows()).map((row) => [row.position, row.description, row.minutes, row.rate_cents, row.amount_cents])).toEqual([
        [1, 'Website', 750, 8000, 100000], [2, 'Beratung', 90, 9500, 14250],
      ]);
    });

    test('the next invoice of the year gets the next number, and the counter moves on', async () => {
      await Invoice.create(data(), async (number) => PDF(number));
      const second = await Invoice.create(data(), async (number) => PDF(number));

      expect(second.number).toBe('2026-0002');
      expect(await InvoiceCounter.next(2026)).toBe(3);
    });

    test('numbering starts again at 1 in a new year, and the old year keeps counting', async () => {
      await Invoice.create(data(), async (number) => PDF(number));
      const newYear = await Invoice.create(data({ invoiceDate: '2027-01-02' }), async (number) => PDF(number));
      const again = await Invoice.create(data({ invoiceDate: '2026-12-31' }), async (number) => PDF(number));

      expect(newYear.number).toBe('2027-0001');
      expect(again.number).toBe('2026-0002');
    });

    test('a pattern without a year has one counter for all years', async () => {
      const pattern = 'RE-{NNN}';
      await Invoice.create(data({ pattern }), async (number) => PDF(number));
      const next = await Invoice.create(data({ pattern, invoiceDate: '2027-06-01' }), async (number) => PDF(number));

      expect(next.number).toBe('RE-002');
      expect(await InvoiceCounter.next(0)).toBe(3);
    });

    test('uses the number a user raised the counter to', async () => {
      await InvoiceCounter.raise(2026, 42);

      const invoice = await Invoice.create(data(), async (number) => PDF(number));

      expect(invoice.number).toBe('2026-0042');
    });

    test('the date of the invoice decides the year, not today', async () => {
      const invoice = await Invoice.create(data({ invoiceDate: '2019-12-31' }), async (number) => PDF(number));

      expect(invoice.number).toBe('2019-0001');
    });

    test('keeps the customer reference, and the optional details can be missing', async () => {
      const { id } = await Customer.create('Muster GmbH', null);

      const invoice = await Invoice.create(data({ customerId: id, customer: { name: 'Muster GmbH', address: 'Weg 1' }, sender: { name: 'Jana', address: 'Weg 5', taxId: '1' } }), async (number) => PDF(number));

      const [row] = (await mockPool.query('SELECT * FROM invoices')).rows;
      expect(invoice.customer_id).toBe(id);
      expect(row).toMatchObject({ customer_tax_id: null, sender_email: null, sender_bank_details: null });
    });

    test('refuses a number that another invoice already has, with NUMBER_TAKEN', async () => {
      await Invoice.create(data(), async (number) => PDF(number));
      // The pattern was changed to one that makes the same text again, with the counter back at 1 (another counter)
      await mockPool.query("UPDATE invoice_counters SET next_number = 1 WHERE scope_year = 2026");

      await expect(Invoice.create(data(), async (number) => PDF(number))).rejects.toMatchObject({ code: 'NUMBER_TAKEN', number: '2026-0001' });

      expect((await mockPool.query('SELECT count(*) AS n FROM invoices')).rows[0].n).toBe(1);
    });

    test('an error of the PDF stops the invoice: nothing is stored, and the error is passed on', async () => {
      await expect(Invoice.create(data(), async () => { throw new Error('pdf broke'); })).rejects.toThrow('pdf broke');

      expect((await mockPool.query('SELECT count(*) AS n FROM invoices')).rows[0].n).toBe(0);
      expect(await lineRows()).toEqual([]);
    });

    test('refuses a negative amount and an unknown language or VAT mode (the database checks)', async () => {
      for (const change of [{ netCents: -1 }, { language: 'fr' }, { vatMode: 'gross' }, { vatRate: 16 }]) {
        await expect(Invoice.create(data(change), async (number) => PDF(number))).rejects.toThrow();
      }
    });

    test('values are stored as given: no SQL in them runs', async () => {
      const text = "x'); DROP TABLE invoices; --";

      await Invoice.create(data({ customer: { name: text, address: text, taxId: text } }), async (number) => PDF(number));

      expect((await mockPool.query('SELECT customer_name FROM invoices')).rows).toEqual([{ customer_name: text }]);
    });
  });

  describe('the transaction', () => {
    // A pool that records what happens on its connection, to see the transaction itself (pg-mem does not roll back)
    function recordingPool(failOn) {
      const log = [];
      const client = {
        query: jest.fn(async (sql) => {
          const name = String(sql).trim().split(/\s+/)[0];
          log.push(name);
          if (failOn && String(sql).includes(failOn)) throw new Error(`failed on ${failOn}`);
          if (/INSERT INTO invoice_counters/.test(sql)) return { rows: [{ number: 1 }] };
          if (/INSERT INTO invoices/.test(sql)) return { rows: [{ id: 9 }] };
          return { rows: [{ id: 9, number: '2026-0001' }] };
        }),
        release: jest.fn(),
      };
      return { log, client, pool: { query: jest.fn(), connect: jest.fn(async () => client) } };
    }

    test('begins, commits and releases the connection when everything works', async () => {
      const { log, client, pool } = recordingPool();
      mockPool = pool;

      await Invoice.create(data(), async (number) => PDF(number));

      expect(log[0]).toBe('BEGIN');
      expect(log.at(-1)).toBe('COMMIT');
      expect(log).not.toContain('ROLLBACK');
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    test.each([['INSERT INTO invoice_counters'], ['INSERT INTO invoices'], ['INSERT INTO invoice_lines']])('rolls back, releases and passes the error on when %s fails', async (failOn) => {
      const { log, client, pool } = recordingPool(failOn);
      mockPool = pool;

      await expect(Invoice.create(data(), async (number) => PDF(number))).rejects.toThrow(`failed on ${failOn}`);

      expect(log).toContain('ROLLBACK');
      expect(log).not.toContain('COMMIT');
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    test('rolls back when the PDF cannot be made', async () => {
      const { log, client, pool } = recordingPool();
      mockPool = pool;

      await expect(Invoice.create(data(), async () => { throw new Error('pdf broke'); })).rejects.toThrow('pdf broke');

      expect(log).toEqual(['BEGIN', 'INSERT', 'ROLLBACK']);
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    test('reports the error that happened, also when the rollback fails too', async () => {
      const { client, pool } = recordingPool();
      client.query.mockImplementation(async (sql) => {
        if (/ROLLBACK/.test(sql)) throw new Error('connection lost');
        if (/INSERT INTO invoice_counters/.test(sql)) throw new Error('the real error');
        return { rows: [] };
      });
      mockPool = pool;

      await expect(Invoice.create(data(), async (number) => PDF(number))).rejects.toThrow('the real error');
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    test('takes the number, makes the PDF, and only then stores: in that order, on one connection', async () => {
      const { log, pool } = recordingPool();
      mockPool = pool;
      const order = [];

      await Invoice.create(data(), async (number) => { order.push(`render ${number}`); return PDF(number); });

      expect(order).toEqual(['render 2026-0001']);
      expect(log.slice(0, 3)).toEqual(['BEGIN', 'INSERT', 'INSERT']);
      expect(pool.connect).toHaveBeenCalledTimes(1);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('getAll', () => {
    test('lists the invoices without their PDFs, newest invoice date first, and the later one first on the same day', async () => {
      await Invoice.create(data({ invoiceDate: '2026-03-05' }), async (number) => PDF(number));
      await Invoice.create(data({ invoiceDate: '2026-04-01' }), async (number) => PDF(number));
      await Invoice.create(data({ invoiceDate: '2026-04-01' }), async (number) => PDF(number));

      const invoices = await Invoice.getAll();

      expect(invoices.map((invoice) => invoice.number)).toEqual(['2026-0003', '2026-0002', '2026-0001']);
      expect(invoices[0]).not.toHaveProperty('pdf');
      expect(invoices[0]).toMatchObject({ invoice_date: '2026-04-01', period_from: '2026-02-01', customer_name: 'Muster GmbH', net_cents: 114250 });
    });

    test('is empty without invoices', async () => {
      expect(await Invoice.getAll()).toEqual([]);
    });
  });

  describe('getPdf', () => {
    test('returns the number and the stored bytes, unchanged', async () => {
      const { id } = await Invoice.create(data(), async (number) => PDF(number));

      const stored = await Invoice.getPdf(id);

      expect(stored.number).toBe('2026-0001');
      expect(stored.pdf.toString()).toBe('%PDF-test 2026-0001');
    });

    test('is undefined for an invoice that does not exist', async () => {
      expect(await Invoice.getPdf(99)).toBeUndefined();
    });
  });

  describe('delete', () => {
    test('deletes the invoice and its lines and answers with its number', async () => {
      const { id } = await Invoice.create(data(), async (number) => PDF(number));

      expect(await Invoice.delete(id)).toBe('2026-0001');

      expect(await Invoice.getAll()).toEqual([]);
      expect(await lineRows()).toEqual([]);
    });

    test('the number stays used: the next invoice does not get it again', async () => {
      const { id } = await Invoice.create(data(), async (number) => PDF(number));
      await Invoice.delete(id);

      const next = await Invoice.create(data(), async (number) => PDF(number));

      expect(next.number).toBe('2026-0002');
    });

    test('is undefined for an invoice that does not exist, and deletes no other', async () => {
      await Invoice.create(data(), async (number) => PDF(number));

      expect(await Invoice.delete(99)).toBeUndefined();

      expect(await Invoice.getAll()).toHaveLength(1);
    });
  });

  describe('the customer', () => {
    test('deleting the customer keeps its invoices, with the name and address as they were', async () => {
      const { id } = await Customer.create('Muster GmbH', null);
      await Invoice.create(data({ customerId: id }), async (number) => PDF(number));

      await Customer.delete(id);

      const [invoice] = await Invoice.getAll();
      expect(invoice).toMatchObject({ customer_id: null, customer_name: 'Muster GmbH' });
      expect(((await mockPool.query('SELECT customer_address FROM invoices')).rows[0]).customer_address).toBe('Musterweg 1\n12345 Musterstadt');
      expect(await lineRows()).toHaveLength(2);
    });

    test('changing the customer later does not change the invoice', async () => {
      const { id } = await Customer.create('Muster GmbH', null, undefined, undefined, { address: 'Alt 1' });
      await Invoice.create(data({ customerId: id }), async (number) => PDF(number));

      await Customer.update(id, 'Neu AG', null, undefined, undefined, { address: 'Neu 2' });

      expect((await Invoice.getAll())[0].customer_name).toBe('Muster GmbH');
      expect(((await mockPool.query('SELECT customer_address FROM invoices')).rows[0]).customer_address).toBe('Musterweg 1\n12345 Musterstadt');
    });
  });

  describe('the table', () => {
    test('allows no second invoice with the same number', async () => {
      await Invoice.create(data(), async (number) => PDF(number));
      const [row] = (await mockPool.query('SELECT * FROM invoices')).rows;

      await expect(mockPool.query("INSERT INTO invoices (number, invoice_date, period_from, period_to, language, customer_name, customer_address, sender_name, sender_address, sender_tax_id, vat_mode, vat_rate, net_cents, vat_cents, gross_cents, pdf) VALUES ($1, '2026-01-01', '2026-01-01', '2026-01-02', 'de', 'x', 'x', 'x', 'x', 'x', 'regular', 19, 0, 0, 0, 'x')", [row.number])).rejects.toThrow();
    });

    test('migration 017 can run twice and keeps the invoices and their lines', async () => {
      await Invoice.create(data(), async (number) => PDF(number));

      await mockPool.query(migration);

      expect(await Invoice.getAll()).toHaveLength(1);
      expect(await lineRows()).toHaveLength(2);
    });
  });
});

describe('InvoiceCounter.take', () => {
  beforeEach(() => {
    mockPool = createTestPool();
  });

  test('gives 1 for a new counter and then counts on', async () => {
    expect(await InvoiceCounter.take(mockPool, 2026)).toBe(1);
    expect(await InvoiceCounter.take(mockPool, 2026)).toBe(2);
    expect(await InvoiceCounter.next(2026)).toBe(3);
  });

  test('counters of other years are separate', async () => {
    await InvoiceCounter.take(mockPool, 2026);

    expect(await InvoiceCounter.take(mockPool, 2027)).toBe(1);
    expect(await InvoiceCounter.take(mockPool, 0)).toBe(1);
  });

  test('continues from a raised counter', async () => {
    await InvoiceCounter.raise(2026, 100);

    expect(await InvoiceCounter.take(mockPool, 2026)).toBe(100);
    expect(await InvoiceCounter.take(mockPool, 2026)).toBe(101);
  });

  test('several takers at the same time get different numbers', async () => {
    const numbers = await Promise.all(Array.from({ length: 10 }, () => InvoiceCounter.take(mockPool, 2026)));

    expect(new Set(numbers).size).toBe(10);
    expect([...numbers].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
