const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));

const ReportStatus = require('../src/models/ReportStatus');

async function customerWithEntry(name, startTime) {
  const customer = await mockPool.query('INSERT INTO customers (name) VALUES ($1) RETURNING id', [name]);
  const project = await mockPool.query(
    "INSERT INTO projects (customer_id, name) VALUES ($1, 'Projekt') RETURNING id",
    [customer.rows[0].id]
  );
  if (startTime) {
    await mockPool.query(
      'INSERT INTO time_entries (project_id, start_time, end_time) VALUES ($1, $2, $2)',
      [project.rows[0].id, startTime]
    );
  }
  return customer.rows[0].id;
}

describe('ReportStatus', () => {
  beforeEach(() => {
    mockPool = createTestPool();
  });

  test('is a draft until a status is stored', async () => {
    const id = await customerWithEntry('Muster GmbH');
    expect(await ReportStatus.get(id, 2026, 8)).toBe('draft');
  });

  test('stores a status and replaces it on the next save', async () => {
    const id = await customerWithEntry('Muster GmbH');

    await ReportStatus.set(id, 2026, 8, 'ready');
    const saved = await ReportStatus.set(id, 2026, 8, 'sent');

    expect(saved).toMatchObject({ customer_id: id, year: 2026, month: 8, status: 'sent' });
    expect(await ReportStatus.get(id, 2026, 8)).toBe('sent');
    expect(await ReportStatus.get(id, 2026, 9)).toBe('draft');
  });

  test('rejects an unknown status', async () => {
    const id = await customerWithEntry('Muster GmbH');
    await expect(ReportStatus.set(id, 2026, 8, 'paid')).rejects.toThrow();
  });

  test('lists the customers with entries in a month, with their status', async () => {
    const sent = await customerWithEntry('Berger', new Date(2026, 7, 14, 9));
    await customerWithEntry('Anders AG', new Date(2026, 7, 31, 17));
    await customerWithEntry('Nur September', new Date(2026, 8, 1, 9));
    await customerWithEntry('Ohne Einträge');
    await ReportStatus.set(sent, 2026, 8, 'sent');

    expect(await ReportStatus.forMonth(2026, 8)).toEqual([
      expect.objectContaining({ customer_name: 'Anders AG', status: 'draft' }),
      expect.objectContaining({ customer_name: 'Berger', status: 'sent' }),
    ]);
  });

  test('is deleted with its customer', async () => {
    const id = await customerWithEntry('Muster GmbH');
    await ReportStatus.set(id, 2026, 8, 'sent');

    await mockPool.query('DELETE FROM customers WHERE id = $1', [id]);

    expect((await mockPool.query('SELECT * FROM report_status')).rows).toEqual([]);
  });
});
