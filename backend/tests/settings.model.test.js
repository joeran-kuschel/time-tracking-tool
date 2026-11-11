const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));

const Settings = require('../src/models/Settings');
const OPTIONS = require('../src/config/settingsOptions');

const rows = async () => (await mockPool.query('SELECT * FROM settings')).rows;

describe('Settings', () => {
  beforeEach(() => {
    mockPool = createTestPool();
  });

  test('shows no amounts in reports by default, also before anything is saved', async () => {
    expect(await Settings.get()).toEqual({ showAmounts: false });
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
    expect(await Settings.update({ showAmounts: true })).toEqual({ showAmounts: true });

    expect((await rows())[0].show_amounts).toBe(true);
    expect(await Settings.get()).toEqual({ showAmounts: true });
  });

  test('saves the option back to false', async () => {
    await Settings.update({ showAmounts: true });

    expect(await Settings.update({ showAmounts: false })).toEqual({ showAmounts: false });
  });

  test('saving nothing keeps the options and still creates the row', async () => {
    await Settings.update({ showAmounts: true });

    expect(await Settings.update({})).toEqual({ showAmounts: true });
    expect(await Settings.update(undefined)).toEqual({ showAmounts: true });
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

      expect(await Settings.update(options)).toEqual({ showAmounts: true });

      expect((await rows())[0].id).toBe(1);
      expect((await mockPool.query('SELECT count(*) AS n FROM settings')).rows[0].n).toBe(1);
    }
  );

  test('every option has a column of the settings table and a check', async () => {
    await Settings.get();
    const row = (await rows())[0];

    for (const [name, { column, isValid }] of Object.entries(OPTIONS)) {
      expect(Object.keys(row)).toContain(column);
      expect(typeof isValid).toBe('function');
      expect(name).toMatch(/^[a-z][A-Za-z]*$/);
    }
  });
});
