const fs = require('fs');
const path = require('path');
const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));

const Customer = require('../src/models/Customer');

const migration = fs.readFileSync(path.join(__dirname, '..', 'migrations', '016_invoice_details.sql'), 'utf8');

describe('Customer details for invoices', () => {
  beforeEach(() => {
    mockPool = createTestPool();
  });

  test('a customer has no address and no tax ID by default', async () => {
    const customer = await Customer.create('Muster', null);

    expect(customer).toMatchObject({ address: null, tax_id: null });
  });

  test('an existing customer (a row without the columns set) has none', async () => {
    const { id } = (await mockPool.query("INSERT INTO customers (name) VALUES ('Alt') RETURNING id")).rows[0];

    expect(await Customer.getById(id)).toMatchObject({ address: null, tax_id: null });
  });

  test('create saves the address, with its lines, and the tax ID', async () => {
    const customer = await Customer.create('Muster', null, undefined, undefined, { address: 'Musterweg 1\n12345 Beispielstadt', taxId: 'DE123456789' });

    expect(customer).toMatchObject({ address: 'Musterweg 1\n12345 Beispielstadt', tax_id: 'DE123456789' });
    expect(await Customer.getById(customer.id)).toMatchObject({ address: 'Musterweg 1\n12345 Beispielstadt', tax_id: 'DE123456789' });
  });

  test('update changes the address and the tax ID', async () => {
    const { id } = await Customer.create('Muster', null);

    const updated = await Customer.update(id, 'Muster', null, undefined, undefined, { address: 'Neuweg 2', taxId: 'DE1' });

    expect(updated).toMatchObject({ address: 'Neuweg 2', tax_id: 'DE1' });
  });

  test('update without them, or with undefined, keeps the stored values', async () => {
    const { id } = await Customer.create('Muster', null, undefined, undefined, { address: 'Musterweg 1', taxId: 'DE1' });

    await Customer.update(id, 'Neu', null);
    await Customer.update(id, 'Neuer', null, undefined, undefined, {});
    const updated = await Customer.update(id, 'Neuest', null, undefined, undefined, { address: undefined, taxId: undefined });

    expect(updated).toMatchObject({ name: 'Neuest', address: 'Musterweg 1', tax_id: 'DE1' });
  });

  test('null removes one of them and keeps the other', async () => {
    const { id } = await Customer.create('Muster', null, undefined, undefined, { address: 'Musterweg 1', taxId: 'DE1' });

    expect(await Customer.update(id, 'Muster', null, undefined, undefined, { taxId: null })).toMatchObject({ address: 'Musterweg 1', tax_id: null });
    expect(await Customer.update(id, 'Muster', null, undefined, undefined, { address: null })).toMatchObject({ address: null, tax_id: null });
  });

  test('they come with the rounding rule and the report language in one update', async () => {
    const { id } = await Customer.create('Muster', null);

    const updated = await Customer.update(id, 'Muster', null, { minutes: 15, direction: 'up' }, 'en', { address: 'Musterweg 1' });

    expect(updated).toMatchObject({ rounding_minutes: 15, rounding_direction: 'up', report_language: 'en', address: 'Musterweg 1' });
  });

  test('values are stored as given: no HTML or SQL in them runs', async () => {
    const text = "x'); DROP TABLE customers; --";
    const customer = await Customer.create('Muster', null, undefined, undefined, { address: text, taxId: '<b>1</b>' });

    expect(await Customer.getById(customer.id)).toMatchObject({ address: text, tax_id: '<b>1</b>' });
    expect(await Customer.getAll()).toHaveLength(1);
  });

  test('the columns hold the limits of the backend: 300 and 30 characters', async () => {
    const customer = await Customer.create('Muster', null, undefined, undefined, { address: 'x'.repeat(300), taxId: 'y'.repeat(30) });

    expect(customer.address).toHaveLength(300);
    expect(customer.tax_id).toHaveLength(30);
  });

  test('migration 016 can run twice and keeps the saved values', async () => {
    const { id } = await Customer.create('Muster', null, undefined, undefined, { address: 'Musterweg 1', taxId: 'DE1' });

    await mockPool.query(migration);

    expect(await Customer.getById(id)).toMatchObject({ address: 'Musterweg 1', tax_id: 'DE1' });
  });
});
