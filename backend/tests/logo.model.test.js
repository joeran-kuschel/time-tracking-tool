const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));

const Logo = require('../src/models/Logo');
// pg-mem (the in-memory test database) turns bytes from 0x80 up into replacement characters, which real Postgres does not:
// these tests use plain ASCII bytes. The binary round trip is checked against a real Postgres in the browser review.
const PNG_BYTES = Buffer.from('png bytes of a logo');
const JPEG_BYTES = Buffer.from('jpeg bytes of a logo');

describe('Logo', () => {
  beforeEach(() => {
    mockPool = createTestPool();
  });

  test('is null when nothing is stored', async () => {
    expect(await Logo.get()).toBeNull();
  });

  test('stores an image and reads the same bytes and type back', async () => {
    const image = PNG_BYTES;

    await Logo.set('image/png', image);
    const logo = await Logo.get();

    expect(logo.contentType).toBe('image/png');
    expect(Buffer.from(logo.data).equals(image)).toBe(true);
  });

  test('keeps the bytes of an image of 1 MB', async () => {
    const all = Buffer.from(Array.from({ length: 1024 * 1024 }, (_, i) => 32 + (i % 90)));

    await Logo.set('image/png', all);

    expect(Buffer.from((await Logo.get()).data).equals(all)).toBe(true);
  });

  test('a new image replaces the old one: there is only ever one row', async () => {
    await Logo.set('image/png', PNG_BYTES);
    await Logo.set('image/jpeg', JPEG_BYTES);

    const logo = await Logo.get();
    expect(logo.contentType).toBe('image/jpeg');
    expect(Buffer.from(logo.data).equals(JPEG_BYTES)).toBe(true);
    expect((await mockPool.query('SELECT count(*) AS n FROM sender_logo')).rows[0].n).toBe(1);
  });

  test('remove deletes it, and removing again is no error', async () => {
    await Logo.set('image/png', PNG_BYTES);

    await Logo.remove();
    await Logo.remove();

    expect(await Logo.get()).toBeNull();
  });

  test('the database refuses another type and a second row', async () => {
    await expect(mockPool.query("INSERT INTO sender_logo (id, content_type, data) VALUES (1, 'image/svg+xml', 'x')")).rejects.toThrow();
    await Logo.set('image/png', PNG_BYTES);
    await expect(mockPool.query("INSERT INTO sender_logo (id, content_type, data) VALUES (2, 'image/png', 'x')")).rejects.toThrow();
  });

  test('reading the settings does not load the image', async () => {
    const Settings = require('../src/models/Settings');
    await Logo.set('image/png', PNG_BYTES);

    expect(Object.keys(await Settings.get())).not.toContain('data');
    expect(JSON.stringify(await Settings.get())).not.toContain('sender_logo');
  });
});
