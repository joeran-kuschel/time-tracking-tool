const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));
jest.mock('../src/models/Session');

const Session = require('../src/models/Session');
const { createApp } = require('../src/app');

const LOGGED_IN = { Cookie: 'session=abc' };
let server;
let baseUrl;

const get = (query, headers = LOGGED_IN) => fetch(`${baseUrl}/api/time-entries/search?${query}`, { headers });

beforeAll((done) => {
  server = createApp({ corsOrigins: [] }).listen(0, () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

beforeEach(async () => {
  mockPool = createTestPool();
  Session.findUser.mockResolvedValue({ id: 1, email: 'me@example.com' });
  jest.spyOn(console, 'error').mockImplementation(() => {});

  const customerId = (await mockPool.query("INSERT INTO customers (name) VALUES ('Muster GmbH') RETURNING id")).rows[0].id;
  const projectId = (await mockPool.query("INSERT INTO projects (customer_id, name, hourly_rate) VALUES ($1, 'Website', 80) RETURNING id", [customerId])).rows[0].id;
  await mockPool.query(
    `INSERT INTO time_entries (project_id, start_time, end_time, description) VALUES
      ($1, '2026-09-21 08:00:00', '2026-09-21 09:30:00', 'Konzept Phase 1'),
      ($1, '2026-09-22 08:00:00', NULL, 'Umsetzung')`,
    [projectId]
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET /api/time-entries/search', () => {
  test('answers 401 without a login', async () => {
    const response = await get('', {});

    expect(response.status).toBe(401);
  });

  test('answers the matches with total, hours and paging', async () => {
    const response = await get('q=konzept&tz=Europe%2FBerlin');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ total: 1, hours: 1.5, limit: 50, offset: 0 });
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]).toMatchObject({ description: 'Konzept Phase 1', customer_name: 'Muster GmbH', project_name: 'Website' });
  });

  test('is not taken for the entry with the id "search"', async () => {
    const body = await (await get('')).json();

    expect(body.total).toBe(2);
  });

  test.each(['to=9999-12-31', 'from=0000-01-01'])('answers 400 instead of failing in the database for %s', async (query) => {
    expect((await get(query)).status).toBe(400)
  })

  test('accepts the last supported day', async () => {
    expect((await get('to=9998-12-31')).status).toBe(200)
  })

  test('answers 400 for an invalid date', async () => {
    const response = await get('from=2026-02-30');

    expect(response.status).toBe(400);
  });

  test.each([
    ['limit=201'], ['limit=0'], ['limit=1&limit=2'], ['offset=-1'], ['q=' + 'a'.repeat(201)], ['sort=id'], ['customerId=abc'], ['q=a&q=b'],
  ])('answers 400 for %s', async (query) => {
    const response = await get(query);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
  });

  test('accepts a search text of exactly 200 characters and the limit 200', async () => {
    const response = await get(`q=${'a'.repeat(200)}&limit=200`);

    expect(response.status).toBe(200);
    expect((await response.json()).limit).toBe(200);
  });

  test('finds a text with %, _ and a backslash only literally', async () => {
    await mockPool.query("INSERT INTO time_entries (project_id, start_time, end_time, description) VALUES (1, '2026-09-23 08:00:00', '2026-09-23 09:00:00', '100% C:\\temp')");

    const body = await (await get(`q=${encodeURIComponent('%')}`)).json();
    const wildcard = await (await get(`q=${encodeURIComponent('Ko_zept')}`)).json();

    expect(body.entries.map((e) => e.description)).toEqual(['100% C:\\temp']);
    expect(wildcard.total).toBe(0);
  });

  test('answers an empty result for a project that belongs to another customer', async () => {
    const other = (await mockPool.query("INSERT INTO customers (name) VALUES ('Zweiter') RETURNING id")).rows[0].id;

    const body = await (await get(`customerId=${other}&projectId=1`)).json();

    expect(body).toMatchObject({ entries: [], total: 0, hours: 0 });
  });

  test('counts a running entry but not its hours, and pages with limit and offset', async () => {
    const first = await (await get('limit=1&offset=0')).json();
    const second = await (await get('limit=1&offset=1')).json();

    expect(first.entries.map((e) => e.description)).toEqual(['Umsetzung']);
    expect(second.entries.map((e) => e.description)).toEqual(['Konzept Phase 1']);
    expect([first.total, second.total, first.hours]).toEqual([2, 2, 1.5]);
  });

  test('answers 500 when the database fails', async () => {
    mockPool = { query: () => Promise.reject(new Error('db down')) };

    const response = await get('');

    expect(response.status).toBe(500);
  });
});
