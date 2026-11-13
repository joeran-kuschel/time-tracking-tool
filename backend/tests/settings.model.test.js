const fs = require('fs');
const path = require('path');
const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));

const Settings = require('../src/models/Settings');
const OPTIONS = require('../src/config/settingsOptions');

// What a fresh install has: no amounts, no rounding (direction up once a step is chosen), no sentence about it
const DEFAULTS = { showAmounts: false, roundingMinutes: 0, roundingDirection: 'up', showRoundingNote: false };

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

    for (const [name, { column, isValid }] of Object.entries(OPTIONS)) {
      expect(Object.keys(row)).toContain(column);
      expect(typeof isValid).toBe('function');
      expect(name).toMatch(/^[a-z][A-Za-z]*$/);
    }
  });
});
