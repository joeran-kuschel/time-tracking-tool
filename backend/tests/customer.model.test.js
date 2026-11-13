const fs = require('fs');
const path = require('path');
const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));

const Customer = require('../src/models/Customer');

const migration = fs.readFileSync(path.join(__dirname, '..', 'migrations', '009_customer_rounding.sql'), 'utf8');
const rule = (customer) => [customer.rounding_minutes, customer.rounding_direction];

describe('Customer rounding rule', () => {
  beforeEach(() => {
    mockPool = createTestPool();
  });

  test('a customer uses the global setting by default: both columns are null', async () => {
    const customer = await Customer.create('Muster', null);

    expect(rule(customer)).toEqual([null, null]);
    expect(rule(await Customer.getById(customer.id))).toEqual([null, null]);
  });

  test('a customer created without the migration columns being set (an existing one) has no own rule', async () => {
    const { id } = (await mockPool.query("INSERT INTO customers (name) VALUES ('Alt') RETURNING id")).rows[0];

    expect(rule(await Customer.getById(id))).toEqual([null, null]);
    expect((await Customer.getAll()).map(rule)).toEqual([[null, null]]);
  });

  test('create saves an own rule', async () => {
    const customer = await Customer.create('Muster', 'a@b.de', { minutes: 15, direction: 'nearest' });

    expect(rule(customer)).toEqual([15, 'nearest']);
    expect(rule(await Customer.getById(customer.id))).toEqual([15, 'nearest']);
  });

  test('no rounding for this customer is stored as 0 minutes', async () => {
    const customer = await Customer.create('Muster', null, { minutes: 0, direction: 'up' });

    expect(rule(customer)).toEqual([0, 'up']);
  });

  test('update without a rule keeps the stored one and changes name and email', async () => {
    const { id } = await Customer.create('Muster', null, { minutes: 30, direction: 'up' });

    const updated = await Customer.update(id, 'Neu', 'x@y.de', undefined);

    expect([updated.name, updated.email]).toEqual(['Neu', 'x@y.de']);
    expect(rule(updated)).toEqual([30, 'up']);
  });

  test('update with a rule replaces it, with null it removes it again', async () => {
    const { id } = await Customer.create('Muster', null, { minutes: 30, direction: 'up' });

    expect(rule(await Customer.update(id, 'Muster', null, { minutes: 60, direction: 'nearest' }))).toEqual([60, 'nearest']);
    expect(rule(await Customer.update(id, 'Muster', null, null))).toEqual([null, null]);
  });

  test('update of an unknown customer finds nothing, with or without a rule', async () => {
    expect(await Customer.update(999, 'X', null, undefined)).toBeUndefined();
    expect(await Customer.update(999, 'X', null, { minutes: 15, direction: 'up' })).toBeUndefined();
  });

  test.each([5, 10, 15, 30, 60, 0])('the database accepts the step %s', async (minutes) => {
    await expect(Customer.create('Muster', null, { minutes, direction: 'up' })).resolves.toMatchObject({ rounding_minutes: minutes });
  });

  test.each([[20, 'up'], [-5, 'up'], [15, 'down'], [15, null], [null, 'up']])('the database refuses minutes %s with direction %s', async (minutes, direction) => {
    await expect(mockPool.query('INSERT INTO customers (name, rounding_minutes, rounding_direction) VALUES ($1, $2, $3)', ['X', minutes, direction])).rejects.toThrow();
  });

  // The steps are in settings_rounding_minutes_check and customers_rounding_minutes_check; a step added to
  // config/settingsOptions.js without a migration for both fails here (and in settings.model.test.js)
  test('the steps the database accepts for a customer are exactly those of config/settingsOptions.js', async () => {
    const OPTIONS = require('../src/config/settingsOptions');
    const accepted = [];
    for (let minutes = -5; minutes <= 180; minutes++) {
      try {
        await mockPool.query('INSERT INTO customers (name, rounding_minutes, rounding_direction) VALUES ($1, $2, $3)', ['X', minutes, 'up']);
        accepted.push(minutes);
      } catch {
        // refused by the check
      }
    }

    expect(accepted).toEqual(Array.from({ length: 186 }, (_, i) => i - 5).filter((minutes) => OPTIONS.roundingMinutes.isValid(minutes)));
  });

  test('keeps another customer unchanged when one is updated', async () => {
    const a = await Customer.create('A', null, { minutes: 15, direction: 'up' });
    const b = await Customer.create('B', null);

    await Customer.update(b.id, 'B', null, { minutes: 30, direction: 'nearest' });

    expect(rule(await Customer.getById(a.id))).toEqual([15, 'up']);
  });

  test('migration 009 can run again and keeps the saved rules', async () => {
    const { id } = await Customer.create('Muster', null, { minutes: 10, direction: 'nearest' });

    await mockPool.query(migration);
    await mockPool.query(migration);

    expect(rule(await Customer.getById(id))).toEqual([10, 'nearest']);
    await expect(Customer.create('Y', null, { minutes: 20, direction: 'up' })).rejects.toThrow();
  });

  test('migration 009 on a table without the columns keeps the existing customers and gives them no own rule', async () => {
    // Postgres drops a column's checks with it; pg-mem keeps them, so they go first
    for (const name of ['both_or_none', 'minutes', 'direction']) {
      await mockPool.query(`ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_rounding_${name}_check`);
    }
    await mockPool.query('ALTER TABLE customers DROP COLUMN rounding_minutes');
    await mockPool.query('ALTER TABLE customers DROP COLUMN rounding_direction');
    const { id } = (await mockPool.query("INSERT INTO customers (name, email) VALUES ('Alt', 'a@b.de') RETURNING id")).rows[0];

    await mockPool.query(migration);

    const customer = await Customer.getById(id);
    expect([customer.name, customer.email]).toEqual(['Alt', 'a@b.de']);
    // Postgres gives the old row NULL; pg-mem leaves the new columns undefined. Both mean "no own rule" (utils/rounding.js)
    expect(rule(customer).map((value) => value ?? null)).toEqual([null, null]);
    expect(rule(await Customer.update(id, 'Alt', null, { minutes: 15, direction: 'up' }))).toEqual([15, 'up']);
  });
});
