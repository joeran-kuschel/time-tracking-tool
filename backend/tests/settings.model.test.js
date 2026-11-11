const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));

const Settings = require('../src/models/Settings');

describe('Settings', () => {
  beforeEach(() => {
    mockPool = createTestPool();
  });

  test('has no options yet, also before anything is saved', async () => {
    expect(await Settings.get()).toEqual({});
  });

  test('the first read creates the row, so an option has the default of its column', async () => {
    await mockPool.query('ALTER TABLE settings ADD COLUMN tidy BOOLEAN NOT NULL DEFAULT true');

    expect(await Settings.get()).toEqual({ tidy: true });
    expect((await mockPool.query('SELECT id FROM settings')).rows).toEqual([{ id: 1 }]);
    expect(await Settings.get()).toEqual({ tidy: true });
    expect((await mockPool.query('SELECT id FROM settings')).rows).toEqual([{ id: 1 }]);
  });

  test('saving creates the single row and keeps it single', async () => {
    expect(await Settings.update({})).toEqual({});
    expect(await Settings.update({})).toEqual({});

    const rows = await mockPool.query('SELECT id FROM settings');
    expect(rows.rows).toEqual([{ id: 1 }]);
  });

  test('allows no second row', async () => {
    await expect(mockPool.query('INSERT INTO settings (id) VALUES (2)')).rejects.toThrow();
  });
});
