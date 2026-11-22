const fs = require('fs');
const path = require('path');
const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));

const Settings = require('../src/models/Settings');
const OPTIONS = require('../src/config/settingsOptions');

// What a fresh install has: no amounts, no rounding (direction up once a step is chosen), no sentence about it, no default rate
const DEFAULTS = { showAmounts: false, roundingMinutes: 0, roundingDirection: 'up', showRoundingNote: false, defaultHourlyRate: null, weekStart: 'monday', senderName: null, senderAddress: null, senderEmail: null, senderTaxId: null, senderBankDetails: null, vatMode: 'regular', vatRate: 19, invoiceNumberPattern: '{YYYY}-{NNNN}', invoiceNextNumber: 1 };

const rows = async () => (await mockPool.query('SELECT * FROM settings')).rows;

describe('Settings', () => {
  beforeEach(() => {
    mockPool = createTestPool();
  });

  test('shows no amounts in reports by default, also before anything is saved', async () => {
    expect(await Settings.get()).toEqual(DEFAULTS);
  });

  test('the first read creates the single row, and later reads keep it single', async () => {
    await Settings.get();
    await Settings.get();

    expect(await rows()).toHaveLength(1);
    expect((await rows())[0].id).toBe(1);
  });

  test('allows no second row', async () => {
    await expect(mockPool.query('INSERT INTO settings (id) VALUES (2)')).rejects.toThrow();
  });

  test('saves an option, returns all options and stores it in its column', async () => {
    expect(await Settings.update({ showAmounts: true })).toEqual({ ...DEFAULTS, showAmounts: true });

    expect((await rows())[0].show_amounts).toBe(true);
    expect(await Settings.get()).toEqual({ ...DEFAULTS, showAmounts: true });
  });

  test('does not round by default, and the direction is up', async () => {
    expect(await Settings.get()).toMatchObject({ roundingMinutes: 0, roundingDirection: 'up' });
  });

  test('saves the rounding step and direction together in one statement', async () => {
    expect(await Settings.update({ roundingMinutes: 15, roundingDirection: 'nearest' })).toEqual({
      ...DEFAULTS, roundingMinutes: 15, roundingDirection: 'nearest',
    });

    const [row] = await rows();
    expect([row.rounding_minutes, row.rounding_direction]).toEqual([15, 'nearest']);
  });

  test('saving one option leaves the others as they were', async () => {
    await Settings.update({ roundingMinutes: 30, roundingDirection: 'nearest', showAmounts: true });

    expect(await Settings.update({ roundingMinutes: 15 })).toEqual({ ...DEFAULTS, showAmounts: true, roundingMinutes: 15, roundingDirection: 'nearest' });
  });

  test.each([[5], [10], [15], [30], [60], [0]])('the database accepts the step %s and the model returns it as a number', async (minutes) => {
    expect(await Settings.update({ roundingMinutes: minutes })).toMatchObject({ roundingMinutes: minutes });
  });

  test.each([[{ roundingMinutes: 20 }], [{ roundingMinutes: -15 }], [{ roundingDirection: 'down' }]])(
    'the database refuses %j', async (change) => {
      await Settings.get();
      const [name] = Object.keys(change);
      const column = name === 'roundingMinutes' ? 'rounding_minutes' : 'rounding_direction';
      const value = Object.values(change)[0];

      await expect(mockPool.query(`UPDATE settings SET ${column} = $1`, [value])).rejects.toThrow();
    }
  );

  describe('migration 008 (the steps 5, 10 and 60)', () => {
    const migration = fs.readFileSync(path.join(__dirname, '..', 'migrations', '008_settings_rounding_steps.sql'), 'utf8');
    const accepts = async (minutes) => {
      try {
        await mockPool.query('UPDATE settings SET rounding_minutes = $1', [minutes]);
        return true;
      } catch {
        return false;
      }
    };

    test('brings an install that applied the first 007 (steps 0, 15, 30) to the new steps', async () => {
      await Settings.get();
      // The state of such an install: the check as the first 007 made it
      await mockPool.query('ALTER TABLE settings DROP CONSTRAINT settings_rounding_minutes_check');
      await mockPool.query('ALTER TABLE settings ADD CONSTRAINT settings_rounding_minutes_check CHECK (rounding_minutes IN (0, 15, 30))');
      expect([await accepts(5), await accepts(60), await accepts(15)]).toEqual([false, false, true]);

      await mockPool.query(migration);

      expect([await accepts(5), await accepts(10), await accepts(60), await accepts(30)]).toEqual([true, true, true, true]);
      expect([await accepts(20), await accepts(45), await accepts(-5)]).toEqual([false, false, false]);
    });

    test('can run again, also on a fresh install that has the check from 007, and keeps the saved step', async () => {
      await Settings.update({ roundingMinutes: 10, roundingDirection: 'nearest' });

      await mockPool.query(migration);
      await mockPool.query(migration);

      expect(await Settings.get()).toMatchObject({ roundingMinutes: 10, roundingDirection: 'nearest' });
      expect(await accepts(60)).toBe(true);
      expect(await accepts(20)).toBe(false);
    });
  });

  // The steps are in settings_rounding_minutes_check and customers_rounding_minutes_check; see customer.model.test.js
  test('the steps the database accepts for the settings are exactly those of config/settingsOptions.js', async () => {
    const OPTIONS = require('../src/config/settingsOptions');
    await Settings.get();
    const accepted = [];
    for (let minutes = -5; minutes <= 180; minutes++) {
      try {
        await mockPool.query('UPDATE settings SET rounding_minutes = $1', [minutes]);
        accepted.push(minutes);
      } catch {
        // refused by the check
      }
    }

    expect(accepted).toEqual(Array.from({ length: 186 }, (_, i) => i - 5).filter((minutes) => OPTIONS.roundingMinutes.isValid(minutes)));
  });

  test('reads values at the limits of the CHECK constraints', async () => {
    await Settings.get();
    await mockPool.query("UPDATE settings SET rounding_minutes = 30, rounding_direction = 'nearest', show_rounding_note = true");

    expect(await Settings.get()).toEqual({ ...DEFAULTS, roundingMinutes: 30, roundingDirection: 'nearest', showRoundingNote: true });
  });

  test('the rounding step comes back as a number, not a string', async () => {
    await Settings.update({ roundingMinutes: 15 });

    expect((await Settings.get()).roundingMinutes).toBe(15);
  });

  test('migration 007 can run twice without error and keeps the saved values', async () => {
    await Settings.update({ roundingMinutes: 15, roundingDirection: 'nearest', showRoundingNote: true });
    const sql = require('fs').readFileSync(require('path').join(__dirname, '..', 'migrations', '007_settings_rounding.sql'), 'utf8');

    await mockPool.query(sql);

    expect(await Settings.get()).toMatchObject({ roundingMinutes: 15, roundingDirection: 'nearest', showRoundingNote: true });
  });

  test('does not name the rounding rule in reports by default, and saves the choice', async () => {
    expect(await Settings.get()).toMatchObject({ showRoundingNote: false });

    expect(await Settings.update({ showRoundingNote: true })).toMatchObject({ showRoundingNote: true });
    expect((await rows())[0].show_rounding_note).toBe(true);
    expect(await Settings.update({ showRoundingNote: false })).toMatchObject({ showRoundingNote: false });
  });

  test('saves the option back to false', async () => {
    await Settings.update({ showAmounts: true });

    expect(await Settings.update({ showAmounts: false })).toEqual(DEFAULTS);
  });

  test('saving nothing keeps the options and still creates the row', async () => {
    await Settings.update({ showAmounts: true });

    expect(await Settings.update({})).toEqual({ ...DEFAULTS, showAmounts: true });
    expect(await Settings.update(undefined)).toEqual({ ...DEFAULTS, showAmounts: true });
    expect(await rows()).toHaveLength(1);
  });

  test('moves updated_at when saving', async () => {
    await Settings.update({});
    await mockPool.query("UPDATE settings SET updated_at = '2000-01-01'");

    await Settings.update({ showAmounts: true });

    expect(new Date((await rows())[0].updated_at).getFullYear()).toBeGreaterThan(2000);
  });

  // The column names come from config/settingsOptions.js, never from the caller
  test.each(['id', 'updated_at', 'show_amounts', 'constructor', '__proto__', 'x = 1; DROP TABLE settings; --'])(
    'ignores the name %s that is not an option', async (name) => {
      const options = JSON.parse(JSON.stringify({ showAmounts: true }));
      Object.defineProperty(options, name, { value: 5, enumerable: true, configurable: true });

      expect(await Settings.update(options)).toEqual({ ...DEFAULTS, showAmounts: true });

      expect((await rows())[0].id).toBe(1);
      expect((await mockPool.query('SELECT count(*) AS n FROM settings')).rows[0].n).toBe(1);
    }
  );

  test('every option has a column of the settings table and a check', async () => {
    await Settings.get();
    const row = (await rows())[0];

    // The counter of the invoice numbers is the one option without a column (it is in invoice_counters)
    for (const [name, { column, counter, isValid }] of Object.entries(OPTIONS)) {
      if (counter) expect(column).toBeUndefined();
      else expect(Object.keys(row)).toContain(column);
      expect(typeof isValid).toBe('function');
      expect(name).toMatch(/^[a-z][A-Za-z]*$/);
    }
  });
  describe('your own details', () => {
    const details = { senderName: 'Jana Beispiel', senderAddress: 'Musterweg 1\n12345 Beispielstadt', senderEmail: 'jana@example.test' };

    test('are not set on a fresh install', async () => {
      const settings = await Settings.get();

      expect([settings.senderName, settings.senderAddress, settings.senderEmail]).toEqual([null, null, null]);
    });

    test('are saved and read back, with the lines of the address', async () => {
      expect(await Settings.update(details)).toEqual({ ...DEFAULTS, ...details });
      expect((await rows())[0]).toEqual(expect.objectContaining({ sender_name: 'Jana Beispiel', sender_address: 'Musterweg 1\n12345 Beispielstadt', sender_email: 'jana@example.test' }));
    });

    test('can be removed again with null, one at a time', async () => {
      await Settings.update(details);

      expect(await Settings.update({ senderAddress: null })).toEqual({ ...DEFAULTS, ...details, senderAddress: null });
    });

    test('saving another option keeps them', async () => {
      await Settings.update(details);

      expect(await Settings.update({ showAmounts: true })).toEqual({ ...DEFAULTS, ...details, showAmounts: true });
    });

    test('migration 013 can run twice and keeps the saved details', async () => {
      await Settings.update(details);
      const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '013_settings_sender_details.sql'), 'utf8');

      await mockPool.query(sql);

      expect(await Settings.get()).toEqual({ ...DEFAULTS, ...details });
    });

    test.each([
      ['senderName', 'Jana Beispiel', true], ['senderName', 'Ł'.repeat(100), true], ['senderName', 'x'.repeat(101), false],
      ['senderName', '', false], ['senderName', ' Jana', false], ['senderName', 'Jana ', false], ['senderName', 'Jana\nBeispiel', false],
      ['senderName', 'Jana\tB', false], ['senderName', null, true], ['senderName', 5, false], ['senderName', undefined, false],
      ['senderAddress', 'Musterweg 1\n12345 Beispielstadt', true], ['senderAddress', 'x'.repeat(300), true], ['senderAddress', 'x'.repeat(301), false],
      ['senderAddress', 'a\nb\nc\nd\ne\nf', true], ['senderAddress', 'a\nb\nc\nd\ne\nf\ng', false],
      ['senderAddress', 'a\r\nb', false], ['senderAddress', 'a\tb', false], ['senderAddress', '\nMusterweg', false], ['senderAddress', null, true],
      ['senderEmail', 'jana@example.test', true], ['senderEmail', 'a@b.co', true], ['senderEmail', 'jana@example', false],
      ['senderEmail', 'jana example@x.de', false], ['senderEmail', '@x.de', false], ['senderEmail', 'jana@@x.de', false],
      ['senderEmail', `${'a'.repeat(250)}@x.de`, false], ['senderEmail', '', false], ['senderEmail', null, true], ['senderEmail', 7, false],
    ])('%s accepts %j: %j', (name, value, valid) => {
      expect(OPTIONS[name].isValid(value)).toBe(valid);
    });
  });

  describe('first day of the week', () => {
    test('is Monday on a fresh install', async () => {
      expect((await Settings.get()).weekStart).toBe('monday');
    });

    test('is saved, read back and kept when another option is saved', async () => {
      expect((await Settings.update({ weekStart: 'sunday' })).weekStart).toBe('sunday');
      expect((await Settings.update({ showAmounts: true })).weekStart).toBe('sunday');
      expect((await rows())[0].week_start).toBe('sunday');
    });

    test.each([['monday', true], ['sunday', true], ['saturday', false], ['Monday', false], ['', false], [null, false], [1, false], [true, false]])(
      'accepts only monday and sunday: %j is %j', (value, valid) => {
        expect(OPTIONS.weekStart.isValid(value)).toBe(valid);
      }
    );

    test('the database refuses another value', async () => {
      await Settings.get();

      await expect(mockPool.query("UPDATE settings SET week_start = 'friday'")).rejects.toThrow();
    });

    test('migration 012 keeps the saved day on a second run', async () => {
      await Settings.update({ weekStart: 'sunday' });
      const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '012_settings_week_start.sql'), 'utf8');

      await mockPool.query(sql);

      expect((await Settings.get()).weekStart).toBe('sunday');
    });
  });

  describe('default hourly rate', () => {
    test('is not set on a fresh install', async () => {
      expect((await Settings.get()).defaultHourlyRate).toBeNull();
    });

    test('is saved and read back as a number, not as the string of the DECIMAL column', async () => {
      expect((await Settings.update({ defaultHourlyRate: 80 })).defaultHourlyRate).toBe(80);
      expect((await Settings.update({ defaultHourlyRate: 95.5 })).defaultHourlyRate).toBe(95.5);
      expect((await rows())[0].default_hourly_rate).not.toBeNull();
      expect((await Settings.get()).defaultHourlyRate).toBe(95.5);
    });

    test('can be removed again with null', async () => {
      await Settings.update({ defaultHourlyRate: 80 });

      expect((await Settings.update({ defaultHourlyRate: null })).defaultHourlyRate).toBeNull();
    });

    test('saving another option keeps it', async () => {
      await Settings.update({ defaultHourlyRate: 80 });

      expect(await Settings.update({ showAmounts: true })).toEqual({ ...DEFAULTS, showAmounts: true, defaultHourlyRate: 80 });
    });

    test('0 is a rate, different from no default', async () => {
      expect((await Settings.update({ defaultHourlyRate: 0 })).defaultHourlyRate).toBe(0);
    });

    test('the database refuses a negative rate', async () => {
      await Settings.get();

      await expect(mockPool.query('UPDATE settings SET default_hourly_rate = -1')).rejects.toThrow();
    });

    test('migration 010 can run twice and keeps the saved rate', async () => {
      await Settings.update({ defaultHourlyRate: 80 });
      const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '010_settings_default_hourly_rate.sql'), 'utf8');

      await mockPool.query(sql);

      expect((await Settings.get()).defaultHourlyRate).toBe(80);
    });

    // Sums and products that are not exact in binary floating point are still amounts with two decimals
    test.each([[0.1 + 0.2], [1.01],[8.2], [19.99], [4.35], [1.15], [0.07], [99999999.99]])('accepts %j despite float error', (value) => {
      expect(OPTIONS.defaultHourlyRate.isValid(value)).toBe(true);
    });

    test.each([[1.005], [0.001], [80.001], [0.004], [99999999.999], [1e-7 + 80.5]])('refuses %j: more than two decimals', (value) => {
      expect(OPTIONS.defaultHourlyRate.isValid(value)).toBe(false);
    });

    test('refuses 80.000000001: more than two decimals', () => {
      expect(OPTIONS.defaultHourlyRate.isValid(80.000000001)).toBe(false);
    });

    test.each([[null, true], [0, true], [80, true], [80.5, true], [80.55, true], [99999999.99, true],
      [-0.01, false], [80.555, false], [100000000, false], [NaN, false], [Infinity, false], ['80', false], ['', false], [true, false], [undefined, false], [[80], false]])(
      'validates %j: %s', (value, valid) => {
        expect(OPTIONS.defaultHourlyRate.isValid(value)).toBe(valid);
      }
    );
  });

  describe('the bank details', () => {
    test('are not set on a fresh install, are saved with their lines, and can be removed again', async () => {
      expect((await Settings.get()).senderBankDetails).toBeNull();

      const saved = await Settings.update({ senderBankDetails: 'DE89 3704 0044 0532 0130 00\nBIC COBADEFFXXX' });
      expect(saved.senderBankDetails).toBe('DE89 3704 0044 0532 0130 00\nBIC COBADEFFXXX');
      expect((await rows())[0].sender_bank_details).toBe('DE89 3704 0044 0532 0130 00\nBIC COBADEFFXXX');

      expect((await Settings.update({ senderBankDetails: null })).senderBankDetails).toBeNull();
    });

    test('saving another option keeps them', async () => {
      await Settings.update({ senderBankDetails: 'IBAN 1' });

      expect((await Settings.update({ showAmounts: true })).senderBankDetails).toBe('IBAN 1');
    });

    test.each([
      [null, true], ['IBAN', true], ['1\n2\n3\n4', true], ['x'.repeat(300), true],
      ['', false], ['1\n2\n3\n4\n5', false], ['x'.repeat(301), false], [' IBAN', false], ['IBAN ', false], ['a\tb', false], [5, false], [undefined, false],
    ])('accepts or refuses %j: %s', (value, valid) => {
      expect(OPTIONS.senderBankDetails.isValid(value)).toBe(valid);
    });

    test('migration 016 can run twice and keeps the saved details', async () => {
      await Settings.update({ senderBankDetails: 'IBAN 1' });
      const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '016_invoice_details.sql'), 'utf8');

      await mockPool.query(sql);

      expect((await Settings.get()).senderBankDetails).toBe('IBAN 1');
    });
  });

  describe('invoicing', () => {
    const jan2026 = new Date('2026-01-15T12:00:00Z');
    const jan2027 = new Date('2027-01-02T12:00:00Z');
    const counters = async () => (await mockPool.query('SELECT scope_year, next_number FROM invoice_counters ORDER BY scope_year')).rows;

    test('are on a fresh install: regular VAT of 19 %, no tax ID, the pattern {YYYY}-{NNNN}, next number 1', async () => {
      expect(await Settings.get()).toMatchObject({ vatMode: 'regular', vatRate: 19, senderTaxId: null, invoiceNumberPattern: '{YYYY}-{NNNN}', invoiceNextNumber: 1 });
    });

    test('VAT, the tax ID and the pattern are saved, read back and kept when another option is saved', async () => {
      const values = { vatMode: 'small_business', vatRate: 7, senderTaxId: 'DE123456789', invoiceNumberPattern: 'RE-{YY}{MM}-{NNN}' };
      await Settings.update(values);
      await Settings.update({ showAmounts: true });

      expect(await Settings.get()).toMatchObject(values);
      expect((await rows())[0]).toMatchObject({ vat_mode: 'small_business', vat_rate: 7, sender_tax_id: 'DE123456789', invoice_number_pattern: 'RE-{YY}{MM}-{NNN}' });
    });

    test('the tax ID can be removed again with null', async () => {
      await Settings.update({ senderTaxId: 'DE123456789' });

      expect((await Settings.update({ senderTaxId: null })).senderTaxId).toBeNull();
    });

    test('the vat rate comes back as a number', async () => {
      await Settings.update({ vatRate: 0 });

      expect((await Settings.get()).vatRate).toBe(0);
    });

    test.each([['vat_mode', "'gross'"], ['vat_rate', '16']])('the database refuses %s = %s', async (column, value) => {
      await Settings.get();

      await expect(mockPool.query(`UPDATE settings SET ${column} = ${value}`)).rejects.toThrow();
    });

    test('the lists the database accepts are exactly those of config/settingsOptions.js', async () => {
      await Settings.get();
      for (const rate of [0, 7, 19, 16, 5]) {
        const accepted = await mockPool.query(`UPDATE settings SET vat_rate = ${rate}`).then(() => true, () => false);
        expect(accepted).toBe(OPTIONS.vatRate.isValid(rate));
      }
      for (const mode of ['regular', 'small_business', 'gross']) {
        const accepted = await mockPool.query(`UPDATE settings SET vat_mode = '${mode}'`).then(() => true, () => false);
        expect(accepted).toBe(OPTIONS.vatMode.isValid(mode));
      }
    });

    test('the next number is stored in invoice_counters for the year of a pattern with a year', async () => {
      await Settings.update({ invoiceNextNumber: 42 }, jan2026);

      expect(await counters()).toEqual([{ scope_year: 2026, next_number: 42 }]);
      expect((await Settings.get(jan2026)).invoiceNextNumber).toBe(42);
    });

    test('a new year starts at 1 again, and the old year keeps its number', async () => {
      await Settings.update({ invoiceNextNumber: 42 }, jan2026);

      expect((await Settings.get(jan2027)).invoiceNextNumber).toBe(1);
      expect((await Settings.get(jan2026)).invoiceNextNumber).toBe(42);
    });

    test('a pattern without a year has one counter that keeps counting', async () => {
      await Settings.update({ invoiceNumberPattern: 'RE-{NNNN}', invoiceNextNumber: 7 }, jan2026);

      expect(await counters()).toEqual([{ scope_year: 0, next_number: 7 }]);
      expect((await Settings.get(jan2027)).invoiceNextNumber).toBe(7);
    });

    test('the number is saved for the counter of the pattern saved with it', async () => {
      await Settings.update({ invoiceNextNumber: 42 }, jan2026);

      await Settings.update({ invoiceNumberPattern: 'RE-{NNNN}', invoiceNextNumber: 3 }, jan2026);

      expect(await counters()).toEqual([{ scope_year: 0, next_number: 3 }, { scope_year: 2026, next_number: 42 }]);
    });

    test('changing only the pattern moves no counter', async () => {
      await Settings.update({ invoiceNextNumber: 42 }, jan2026);

      await Settings.update({ invoiceNumberPattern: 'RE-{YY}-{NN}' }, jan2026);

      expect(await counters()).toEqual([{ scope_year: 2026, next_number: 42 }]);
      expect((await Settings.get(jan2026)).invoiceNextNumber).toBe(42);
    });

    test('the same number again is accepted, a higher one too', async () => {
      await Settings.update({ invoiceNextNumber: 10 }, jan2026);

      expect((await Settings.update({ invoiceNextNumber: 10 }, jan2026)).invoiceNextNumber).toBe(10);
      expect((await Settings.update({ invoiceNextNumber: 11 }, jan2026)).invoiceNextNumber).toBe(11);
    });

    test('a lower number is refused with COUNTER_LOWERED and nothing of the request is saved', async () => {
      await Settings.update({ invoiceNextNumber: 10 }, jan2026);

      await expect(Settings.update({ invoiceNextNumber: 9, showAmounts: true, vatRate: 7 }, jan2026)).rejects.toMatchObject({ code: 'COUNTER_LOWERED' });

      expect(await Settings.get(jan2026)).toMatchObject({ invoiceNextNumber: 10, showAmounts: false, vatRate: 19 });
    });

    test('a lower number for the counter of the new pattern is refused and the new pattern is not saved either', async () => {
      await Settings.update({ invoiceNumberPattern: 'RE-{NNNN}', invoiceNextNumber: 10 }, jan2026);
      await Settings.update({ invoiceNumberPattern: '{YYYY}-{NNNN}' }, jan2026);

      await expect(Settings.update({ invoiceNumberPattern: 'RE-{NNNN}', invoiceNextNumber: 3 }, jan2026)).rejects.toMatchObject({ code: 'COUNTER_LOWERED' });

      expect(await Settings.get(jan2026)).toMatchObject({ invoiceNumberPattern: '{YYYY}-{NNNN}', invoiceNextNumber: 1 });
      expect(await counters()).toEqual([{ scope_year: 0, next_number: 10 }]);
    });

    test('the number is compared with the counter of the saved pattern when the request has no pattern', async () => {
      await Settings.update({ invoiceNumberPattern: 'RE-{NNNN}', invoiceNextNumber: 10 }, jan2026);

      await expect(Settings.update({ invoiceNextNumber: 9 }, jan2026)).rejects.toMatchObject({ code: 'COUNTER_LOWERED' });
      expect((await Settings.update({ invoiceNextNumber: 11 }, jan2026)).invoiceNextNumber).toBe(11);
    });

    test('the year of a counter is the UTC year at the turn of the year', async () => {
      await Settings.update({ invoiceNextNumber: 8 }, new Date('2026-12-31T23:59:59Z'));

      expect((await Settings.get(new Date('2027-01-01T00:00:00Z'))).invoiceNextNumber).toBe(1);
      expect((await Settings.get(new Date('2026-12-31T23:59:59Z'))).invoiceNextNumber).toBe(8);
    });

    test('the largest number, 99999999, is stored', async () => {
      expect((await Settings.update({ invoiceNextNumber: 99999999 }, jan2026)).invoiceNextNumber).toBe(99999999);
    });

    // The counter is raised in one conditional statement, so the save that writes last cannot lower what the other raised
    test('two saves at the same time never lower the counter', async () => {
      await Promise.all([Settings.update({ invoiceNextNumber: 20 }, jan2026), Settings.update({ invoiceNextNumber: 10 }, jan2026).catch(() => {})]);

      expect((await Settings.get(jan2026)).invoiceNextNumber).toBe(20);
    });

    test('1 on a fresh counter is not lower, and a year without a row can start at 1', async () => {
      await Settings.update({ invoiceNextNumber: 10 }, jan2026);

      expect((await Settings.update({ invoiceNextNumber: 1 }, jan2027)).invoiceNextNumber).toBe(1);
    });

    test('the database refuses a counter outside 1 to 99999999 and a year outside 1000 to 9999', async () => {
      await expect(mockPool.query('INSERT INTO invoice_counters (scope_year, next_number) VALUES (2026, 0)')).rejects.toThrow();
      await expect(mockPool.query('INSERT INTO invoice_counters (scope_year, next_number) VALUES (2026, 100000000)')).rejects.toThrow();
      await expect(mockPool.query('INSERT INTO invoice_counters (scope_year, next_number) VALUES (12, 1)')).rejects.toThrow();
    });

    test('migration 015 can run twice and keeps the saved values and counters', async () => {
      await Settings.update({ vatMode: 'small_business', senderTaxId: 'DE1', invoiceNextNumber: 5 }, jan2026);
      const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '015_settings_invoicing.sql'), 'utf8');

      await mockPool.query(sql);

      expect(await Settings.get(jan2026)).toMatchObject({ vatMode: 'small_business', senderTaxId: 'DE1', invoiceNextNumber: 5 });
    });

    test.each([
      ['senderTaxId', null, true], ['senderTaxId', 'DE123456789', true], ['senderTaxId', 'x'.repeat(30), true],
      ['senderTaxId', '', false], ['senderTaxId', ' DE1', false], ['senderTaxId', 'x'.repeat(31), false], ['senderTaxId', 'a\nb', false], ['senderTaxId', 5, false],
      ['vatMode', 'regular', true], ['vatMode', 'small_business', true], ['vatMode', 'Regular', false], ['vatMode', null, false],
      ['vatRate', 0, true], ['vatRate', 7, true], ['vatRate', 19, true], ['vatRate', '19', false], ['vatRate', 16, false], ['vatRate', null, false],
      ['invoiceNumberPattern', '{YYYY}-{NNNN}', true], ['invoiceNumberPattern', 'RE-{NNNN}', true], ['invoiceNumberPattern', '{NNNN}', true],
      ['invoiceNumberPattern', '{YYYY}-{NNNN}-{NNNN}', false], ['invoiceNumberPattern', '{YYYY}', false], ['invoiceNumberPattern', '', false],
      ['invoiceNumberPattern', null, false], ['invoiceNumberPattern', 5, false],
      ['invoiceNextNumber', 1, true], ['invoiceNextNumber', 99999999, true],
      ['invoiceNextNumber', 0, false], ['invoiceNextNumber', 100000000, false], ['invoiceNextNumber', 1.5, false], ['invoiceNextNumber', '5', false], ['invoiceNextNumber', null, false],
    ])('%s accepts or refuses %j: %s', (name, value, valid) => {
      expect(OPTIONS[name].isValid(value)).toBe(valid);
    });
  });
});
