const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));
jest.mock('../src/models/Session');

const Session = require('../src/models/Session');
const { createApp } = require('../src/app');

// The billed fields reach the client through the real routes, models and the settings row (pg-mem: DECIMAL precision
// is not enforced, so the rate is checked as the string pg-mem returns).
const LOGGED_IN = { Cookie: 'session=abc' };
let server;
let baseUrl;
let customerId;

const getJson = async (path) => {
  const response = await fetch(`${baseUrl}${path}`, { headers: LOGGED_IN });
  return { status: response.status, body: await response.json() };
};
const setRounding = (roundingMinutes, roundingDirection = 'up') =>
  mockPool.query('INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING')
    .then(() => mockPool.query('UPDATE settings SET rounding_minutes = $1, rounding_direction = $2 WHERE id = 1', [roundingMinutes, roundingDirection]));
const dashboard = () =>
  getJson('/api/dashboard?from=2026-08-31T00:00:00.000Z&to=2026-10-01T00:00:00.000Z&month=9&year=2026&tz=UTC');

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

  customerId = (await mockPool.query("INSERT INTO customers (name) VALUES ('Muster GmbH') RETURNING id")).rows[0].id;
  const projectId = (await mockPool.query("INSERT INTO projects (customer_id, name, hourly_rate) VALUES ($1, 'Website', 95) RETURNING id", [customerId])).rows[0].id;
  await mockPool.query(
    `INSERT INTO time_entries (project_id, start_time, end_time) VALUES
      ($1, '2026-09-21 09:00:00', '2026-09-21 10:05:00'),
      ($1, '2026-09-22 09:00:00', NULL)`,
    [projectId]
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET /api/dashboard with a rounding rule', () => {
  test('adds billed hours and amount to the entries, each with the rule that produced them', async () => {
    await setRounding(15, 'up');

    const { status, body } = await dashboard();

    expect(status).toBe(200);
    expect(body).not.toHaveProperty('rounding');
    const finished = body.entries.find((e) => e.end_time);
    expect(finished).toMatchObject({ billed_hours: '1.25', billed_amount: '118.75', billed_rule: { minutes: 15, direction: 'up' } });
    expect(finished.start_time).toBeDefined();
  });

  test('leaves a running entry unbilled (null) and the recent entries exact', async () => {
    await setRounding(15, 'up');

    const { body } = await dashboard();

    expect(body.entries.find((e) => !e.end_time)).toMatchObject({ billed_hours: null, billed_amount: null, billed_rule: { minutes: 15, direction: 'up' } });
    expect(body.recent.every((e) => !('billed_hours' in e))).toBe(true);
  });

  test('has no billed fields and no rounding without a rule', async () => {
    await setRounding(0);

    const { body } = await dashboard();

    expect(body).not.toHaveProperty('rounding');
    expect(body.entries.every((e) => !('billed_hours' in e) && !('billed_amount' in e))).toBe(true);
  });

  test('has no billed fields when the settings were never saved (defaults)', async () => {
    const { status, body } = await dashboard();

    expect(status).toBe(200);
    expect(body).not.toHaveProperty('rounding');
  });
});

describe('GET /api/time-entries/customer/:id with a rounding rule', () => {
  test('gives each entry billed hours and amount, as an array', async () => {
    await setRounding(30, 'nearest');

    const { status, body } = await getJson(`/api/time-entries/customer/${customerId}`);

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    // 65 min to the nearest half hour is 1 h
    expect(body.find((e) => e.end_time)).toMatchObject({ billed_hours: '1.00', billed_amount: '95.00' });
    expect(body.find((e) => !e.end_time)).toMatchObject({ billed_hours: null, billed_amount: null });
  });

  test('is the plain list of entries without a rule', async () => {
    await setRounding(0);

    const { body } = await getJson(`/api/time-entries/customer/${customerId}`);

    expect(body).toHaveLength(2);
    expect(body.every((e) => !('billed_hours' in e))).toBe(true);
    expect(body[0].hourly_rate).toBeDefined();
  });

  test('is an empty array for a customer without entries', async () => {
    await setRounding(15);
    const other = (await mockPool.query("INSERT INTO customers (name) VALUES ('Leer') RETURNING id")).rows[0].id;

    const { status, body } = await getJson(`/api/time-entries/customer/${other}`);

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  test('needs a login', async () => {
    const response = await fetch(`${baseUrl}/api/time-entries/customer/${customerId}`);

    expect(response.status).toBe(401);
  });
});

// 65 minutes at 95 EUR/h: 5 minutes up = 1.08 h (102.60), 10 minutes nearest = 70 min = 1.17 h (111.15), full hour up = 2.00 h (190.00)
describe.each([
  [5, 'up', '1.08', '102.60'],
  [10, 'nearest', '1.17', '111.15'],
  [60, 'up', '2.00', '190.00'],
  [60, 'nearest', '1.00', '95.00'],
])('the new step %s minutes, %s', (minutes, direction, hours, amount) => {
  beforeEach(() => setRounding(minutes, direction));

  test('the Dashboard entries carry the billed fields and the rule', async () => {
    const { status, body } = await dashboard();

    expect(status).toBe(200);
    expect(body.entries.find((e) => e.end_time)).toMatchObject({
      billed_hours: hours, billed_amount: amount, billed_rule: { minutes, direction },
    });
    expect(body.entries.find((e) => !e.end_time)).toMatchObject({ billed_hours: null, billed_amount: null });
  });

  test('the entries of a customer carry the billed fields', async () => {
    const { body } = await getJson(`/api/time-entries/customer/${customerId}`);

    expect(body.find((e) => e.end_time)).toMatchObject({ billed_hours: hours, billed_amount: amount });
  });
});

test('an awkward rate with a 5-minute step: 0.08 h at 33.33 is 2.67', async () => {
  await setRounding(5, 'up');
  const projectId = (await mockPool.query("INSERT INTO projects (customer_id, name, hourly_rate) VALUES ($1, 'App', 33.33) RETURNING id", [customerId])).rows[0].id;
  await mockPool.query("INSERT INTO time_entries (project_id, start_time, end_time) VALUES ($1, '2026-09-23 09:00:00', '2026-09-23 09:03:00')", [projectId]);

  const { body } = await getJson(`/api/time-entries/customer/${customerId}`);

  expect(body.find((e) => e.project_id === projectId)).toMatchObject({ billed_hours: '0.08', billed_amount: '2.67' });
});
