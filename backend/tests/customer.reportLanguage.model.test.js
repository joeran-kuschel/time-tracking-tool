const fs = require('fs');
const path = require('path');
const { createTestPool } = require('./helpers/testDb');
const { LOCALES } = require('../src/i18n');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));

const Customer = require('../src/models/Customer');

const migration = fs.readFileSync(path.join(__dirname, '..', 'migrations', '011_customer_report_language.sql'), 'utf8');

describe('Customer report language', () => {
  beforeEach(() => {
    mockPool = createTestPool();
  });

  test('a customer uses the language of the app by default: report_language is null', async () => {
    const customer = await Customer.create('Muster', null);

    expect(customer.report_language).toBeNull();
    expect((await Customer.getById(customer.id)).report_language).toBeNull();
  });

  test('an existing customer (a row without the column set) has no own report language', async () => {
    const { id } = (await mockPool.query("INSERT INTO customers (name) VALUES ('Alt') RETURNING id")).rows[0];

    expect((await Customer.getById(id)).report_language).toBeNull();
    expect((await Customer.getAll()).map((c) => c.report_language)).toEqual([null]);
  });

  test.each([['de'], ['en']])('create saves the report language %s', async (language) => {
    const customer = await Customer.create('Muster', null, undefined, language);

    expect(customer.report_language).toBe(language);
    expect((await Customer.getById(customer.id)).report_language).toBe(language);
  });

  test('create with null means the language of the app', async () => {
    expect((await Customer.create('Muster', null, undefined, null)).report_language).toBeNull();
  });

  test('update sets the language, changes it and sets it back to the language of the app with null', async () => {
    const { id } = await Customer.create('Muster', null);

    expect((await Customer.update(id, 'Muster', null, undefined, 'en')).report_language).toBe('en');
    expect((await Customer.update(id, 'Muster', null, undefined, 'de')).report_language).toBe('de');
    expect((await Customer.update(id, 'Muster', null, undefined, null)).report_language).toBeNull();
  });

  test('update without a language keeps the stored one', async () => {
    const { id } = await Customer.create('Muster', null, undefined, 'en');

    const updated = await Customer.update(id, 'Neu', 'x@y.de', undefined, undefined);

    expect(updated).toMatchObject({ name: 'Neu', email: 'x@y.de', report_language: 'en' });
  });

  test('the language and the rounding rule are saved independently of each other', async () => {
    const { id } = await Customer.create('Muster', null, { minutes: 30, direction: 'up' }, 'en');

    const onlyRule = await Customer.update(id, 'Muster', null, { minutes: 15, direction: 'nearest' }, undefined);
    expect(onlyRule).toMatchObject({ rounding_minutes: 15, rounding_direction: 'nearest', report_language: 'en' });

    const onlyLanguage = await Customer.update(id, 'Muster', null, undefined, 'de');
    expect(onlyLanguage).toMatchObject({ rounding_minutes: 15, rounding_direction: 'nearest', report_language: 'de' });

    const both = await Customer.update(id, 'Muster', null, null, null);
    expect(both).toMatchObject({ rounding_minutes: null, rounding_direction: null, report_language: null });
  });

  // Every combination of undefined (keep), null (reset) and a value for the rounding rule and the language: the
  // parameter numbers of the UPDATE shift with each part that is left out
  describe.each([
    ['undefined', undefined, { rounding_minutes: 30, rounding_direction: 'up' }],
    ['null', null, { rounding_minutes: null, rounding_direction: null }],
    ['a rule', { minutes: 15, direction: 'nearest' }, { rounding_minutes: 15, rounding_direction: 'nearest' }],
  ])('update with the rounding rule %s', (_, rounding, expectedRule) => {
    test.each([
      ['undefined', undefined, 'en'],
      ['null', null, null],
      ['de', 'de', 'de'],
    ])('and the language %s', async (__, language, expectedLanguage) => {
      const { id } = await Customer.create('Muster', 'a@b.de', { minutes: 30, direction: 'up' }, 'en');
      const other = await Customer.create('Other', null, { minutes: 60, direction: 'nearest' }, 'de');

      const updated = await Customer.update(id, 'Neu', 'x@y.de', rounding, language);

      expect(updated).toMatchObject({ name: 'Neu', email: 'x@y.de', ...expectedRule, report_language: expectedLanguage });
      expect(await Customer.getById(id)).toMatchObject({ name: 'Neu', ...expectedRule, report_language: expectedLanguage });
      expect(await Customer.getById(other.id)).toMatchObject({ name: 'Other', rounding_minutes: 60, report_language: 'de' });
    });
  });

  test('update refuses an invalid language and keeps the customer as it was', async () => {
    const { id } = await Customer.create('Muster', null, undefined, 'en');

    await expect(Customer.update(id, 'Neu', null, undefined, 'fr')).rejects.toThrow();

    expect(await Customer.getById(id)).toMatchObject({ name: 'Muster', report_language: 'en' });
  });

  test('update of a customer that does not exist answers nothing', async () => {
    expect(await Customer.update(999, 'Muster', null, undefined, 'en')).toBeUndefined();
  });

  test.each([['fr'], ['EN'], ['english'], ['']])('the database refuses the language %j', async (language) => {
    await expect(Customer.create('Muster', null, undefined, language)).rejects.toThrow();
  });

  test('the languages the database accepts are exactly the LOCALES of the backend', async () => {
    for (const language of LOCALES) {
      await expect(Customer.create(`C-${language}`, null, undefined, language)).resolves.toMatchObject({ report_language: language });
    }
    await expect(Customer.create('C-fr', null, undefined, 'fr')).rejects.toThrow();
  });

  test('migration 011 can run twice and keeps the saved languages', async () => {
    const { id } = await Customer.create('Muster', null, undefined, 'en');

    await mockPool.query(migration);

    expect((await Customer.getById(id)).report_language).toBe('en');
  });
});
