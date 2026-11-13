const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));
jest.mock('../src/models/Session');

const Session = require('../src/models/Session');
const { createApp } = require('../src/app');

// A rounding rule per customer through the real routes, models and the settings row (pg-mem). Two customers with the
// same kind of entry (65 minutes at 80.00): "Muster" uses the global setting, "Eigen" has its own rule.
const LOGGED_IN = { Cookie: 'session=abc', 'Content-Type': 'application/json' };
let server;
let baseUrl;
let muster;
let eigen;

const request = async (method, path, body) => {
  const response = await fetch(`${baseUrl}${path}`, { method, headers: LOGGED_IN, body: body === undefined ? undefined : JSON.stringify(body) });
  const type = response.headers.get('content-type') ?? '';
  return { status: response.status, body: type.includes('json') ? await response.json() : await response.text() };
};
const setGlobal = (roundingMinutes, roundingDirection = 'up') =>
  mockPool.query('INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING')
    .then(() => mockPool.query('UPDATE settings SET rounding_minutes = $1, rounding_direction = $2 WHERE id = 1', [roundingMinutes, roundingDirection]));
const setCustomer = (id, minutes, direction) => mockPool.query('UPDATE customers SET rounding_minutes = $1, rounding_direction = $2 WHERE id = $3', [minutes, direction, id]);
const report = (customer, query = '') => request('GET', `/api/reports/customer/${customer}?month=9&year=2026&tz=UTC${query}`);
const dashboard = () => request('GET', '/api/dashboard?from=2026-08-31T00:00:00.000Z&to=2026-10-01T00:00:00.000Z&month=9&year=2026&tz=UTC');

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

  const add = async (name) => (await mockPool.query('INSERT INTO customers (name) VALUES ($1) RETURNING id', [name])).rows[0].id;
  muster = await add('Muster');
  eigen = await add('Eigen');
  for (const customer of [muster, eigen]) {
    const project = (await mockPool.query("INSERT INTO projects (customer_id, name, hourly_rate) VALUES ($1, 'Web', 80) RETURNING id", [customer])).rows[0].id;
    await mockPool.query(
      "INSERT INTO time_entries (project_id, start_time, end_time, description) VALUES ($1, '2026-09-21 09:00:00', '2026-09-21 10:05:00', 'E65')",
      [project]
    );
  }
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the customers API', () => {
  test('GET lists the customers with no own rule by default (both null)', async () => {
    const { status, body } = await request('GET', '/api/customers');

    expect(status).toBe(200);
    expect(body.map((c) => [c.name, c.rounding_minutes, c.rounding_direction])).toEqual([['Eigen', null, null], ['Muster', null, null]]);
  });

  test('POST saves an own rule and PUT changes, keeps and removes it', async () => {
    const created = await request('POST', '/api/customers', { name: 'Neu', roundingMinutes: 30, roundingDirection: 'nearest' });
    expect(created.status).toBe(201);
    expect([created.body.rounding_minutes, created.body.rounding_direction]).toEqual([30, 'nearest']);

    const renamed = await request('PUT', `/api/customers/${created.body.id}`, { name: 'Neu 2' });
    expect([renamed.body.name, renamed.body.rounding_minutes, renamed.body.rounding_direction]).toEqual(['Neu 2', 30, 'nearest']);

    const changed = await request('PUT', `/api/customers/${created.body.id}`, { name: 'Neu 2', roundingMinutes: 60, roundingDirection: 'up' });
    expect([changed.body.rounding_minutes, changed.body.rounding_direction]).toEqual([60, 'up']);

    const cleared = await request('PUT', `/api/customers/${created.body.id}`, { name: 'Neu 2', roundingMinutes: null, roundingDirection: null });
    expect([cleared.body.rounding_minutes, cleared.body.rounding_direction]).toEqual([null, null]);
  });

  test('refuses an invalid rule with 400 and changes nothing', async () => {
    const bad = await request('PUT', `/api/customers/${eigen}`, { name: 'Eigen', roundingMinutes: 20, roundingDirection: 'up' });
    const half = await request('POST', '/api/customers', { name: 'Halb', roundingMinutes: 15 });

    expect(bad.status).toBe(400);
    expect(half.status).toBe(400);
    expect((await request('GET', '/api/customers')).body.map((c) => c.rounding_minutes)).toEqual([null, null]);
  });
});

describe('the report of a customer', () => {
  test('uses the global rule for a customer without an own rule, and its own rule for the other', async () => {
    await setGlobal(15, 'up');
    await setCustomer(eigen, 60, 'up');

    const a = await report(muster, '&amounts=1');
    const b = await report(eigen, '&amounts=1');

    expect(a.body.rounding).toEqual({ minutes: 15, direction: 'up' });
    expect(a.body.entries.map((e) => [e.billed_hours, e.amount])).toEqual([['1.25', '100.00']]);
    expect(a.body.totalHours).toBe('1.25');
    expect(b.body.rounding).toEqual({ minutes: 60, direction: 'up' });
    expect(b.body.entries.map((e) => [e.billed_hours, e.amount])).toEqual([['2.00', '160.00']]);
    expect(b.body.totalHours).toBe('2.00');
    expect(b.body.totalAmount).toBe('160.00');
  });

  test('a customer with an own rule is rounded although the global setting is off', async () => {
    await setGlobal(0);
    await setCustomer(eigen, 30, 'nearest');

    const a = await report(muster);
    const b = await report(eigen);

    expect(a.body).not.toHaveProperty('rounding');
    expect(a.body.totalHours).toBe('1.08');
    expect(b.body.rounding).toEqual({ minutes: 30, direction: 'nearest' });
    expect(b.body.totalHours).toBe('1.00');
  });

  test('a customer set to no rounding stays exact although the global setting rounds', async () => {
    await setGlobal(60, 'up');
    await setCustomer(eigen, 0, 'up');

    const b = await report(eigen);

    expect(b.body).not.toHaveProperty('rounding');
    expect(b.body.entries[0].billed_hours).toBeNull();
    expect(b.body.totalHours).toBe('1.08');
  });

  test('the CSV has the rounded hours of the customer\'s own rule and the exact times', async () => {
    await setGlobal(15, 'up');
    await setCustomer(eigen, 60, 'up');

    const { status, body } = await request('GET', `/api/reports/customer/${eigen}/csv?month=9&year=2026&tz=UTC&lang=en&amounts=1`);

    expect(status).toBe(200);
    expect(body).toContain('2026-09-21,09:00,10:05,Eigen,Web,E65,2.00,80.00,160.00');
  });

  test('the PDF is made with the customer\'s rule (a valid PDF for both customers)', async () => {
    await setGlobal(15, 'up');
    await setCustomer(eigen, 5, 'nearest');
    for (const customer of [muster, eigen]) {
      const response = await fetch(`${baseUrl}/api/reports/customer/${customer}/pdf?month=9&year=2026&tz=UTC&lang=de`, { headers: LOGGED_IN });

      expect(response.status).toBe(200);
      expect(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');
    }
  });

  test('a month without entries has the customer\'s rule too (the JSON of an empty report)', async () => {
    await setGlobal(15, 'up');
    await setCustomer(eigen, 30, 'up');

    const empty = await request('GET', `/api/reports/customer/${eigen}?month=1&year=2020&tz=UTC`);

    expect(empty.status).toBe(200);
    expect(empty.body.entries).toEqual([]);
    expect(empty.body.totalHours).toBe('0.00');
  });
});

describe('the Dashboard and the entries of a customer', () => {
  test('each entry carries the rule of its own customer, so the figures can differ per customer', async () => {
    await setGlobal(15, 'up');
    await setCustomer(eigen, 60, 'nearest');

    const { body } = await dashboard();

    const by = Object.fromEntries(body.entries.map((e) => [e.customer_name, e]));
    expect(by.Muster).toMatchObject({ billed_hours: '1.25', billed_amount: '100.00', billed_rule: { minutes: 15, direction: 'up' } });
    expect(by.Eigen).toMatchObject({ billed_hours: '1.00', billed_amount: '80.00', billed_rule: { minutes: 60, direction: 'nearest' } });
    expect(body.recent.every((e) => !('billed_hours' in e))).toBe(true);
  });

  test('a customer set to no rounding has no billed values and no rule', async () => {
    await setGlobal(15, 'up');
    await setCustomer(eigen, 0, 'up');

    const { body } = await dashboard();

    const own = body.entries.find((e) => e.customer_name === 'Eigen');
    expect(own).toMatchObject({ billed_hours: null, billed_amount: null, billed_rule: null });
    expect(body.entries.find((e) => e.customer_name === 'Muster').billed_rule).toEqual({ minutes: 15, direction: 'up' });
  });

  test('without any rule the Dashboard entries are exact, as before', async () => {
    await setGlobal(0);

    const { body } = await dashboard();

    expect(body.entries.every((e) => !('billed_hours' in e))).toBe(true);
  });

  test('the customer entries (month summary) use the customer\'s rule', async () => {
    await setGlobal(15, 'up');
    await setCustomer(eigen, 60, 'up');

    const a = await request('GET', `/api/time-entries/customer/${muster}`);
    const b = await request('GET', `/api/time-entries/customer/${eigen}`);

    expect(a.body.map((e) => [e.billed_hours, e.billed_amount])).toEqual([['1.25', '100.00']]);
    expect(b.body.map((e) => [e.billed_hours, e.billed_amount])).toEqual([['2.00', '160.00']]);
    expect(b.body[0].billed_rule).toEqual({ minutes: 60, direction: 'up' });
  });

  test('the Dashboard equals the report for each customer', async () => {
    await setGlobal(15, 'nearest');
    await setCustomer(eigen, 30, 'up');

    const { body } = await dashboard();

    for (const [customer, name] of [[muster, 'Muster'], [eigen, 'Eigen']]) {
      const r = await report(customer, '&amounts=1');
      const own = body.entries.filter((e) => e.customer_name === name);
      expect(own.reduce((sum, e) => sum + Number(e.billed_hours), 0).toFixed(2)).toBe(r.body.totalHours);
      expect(own.reduce((sum, e) => sum + Math.round(Number(e.billed_amount) * 100), 0) / 100).toBe(Number(r.body.totalAmount));
    }
  });
});

describe('more cases of a rule per customer', () => {
  test('changing the global setting later does not touch a customer with an own rule, clearing the own rule falls back to it', async () => {
    await setGlobal(15, 'up');
    await setCustomer(eigen, 60, 'up');

    await setGlobal(30, 'up');
    const own = await report(eigen);
    const other = await report(muster);
    await request('PUT', `/api/customers/${eigen}`, { name: 'Eigen', roundingMinutes: null, roundingDirection: null });
    const cleared = await report(eigen);

    expect(own.body.totalHours).toBe('2.00');
    expect(other.body.totalHours).toBe('1.50');
    expect(cleared.body.rounding).toEqual({ minutes: 30, direction: 'up' });
    expect(cleared.body.totalHours).toBe('1.50');
  });

  test('saving a rule through the API changes the next report at once', async () => {
    await setGlobal(0);

    await request('PUT', `/api/customers/${eigen}`, { name: 'Eigen', roundingMinutes: 10, roundingDirection: 'nearest' });

    const { body } = await report(eigen);
    expect(body.rounding).toEqual({ minutes: 10, direction: 'nearest' });
    expect(body.entries[0].billed_hours).toBe('1.17');
  });

  test('a running timer of a customer with an own rule has no billed values but names the rule', async () => {
    await setCustomer(eigen, 30, 'up');
    const project = (await mockPool.query('SELECT id FROM projects WHERE customer_id = $1', [eigen])).rows[0].id;
    await mockPool.query("INSERT INTO time_entries (project_id, start_time, description) VALUES ($1, '2026-09-22 09:00:00', 'läuft')", [project]);

    const { body } = await request('GET', `/api/time-entries/customer/${eigen}`);

    const running = body.find((e) => e.description === 'läuft');
    expect(running).toMatchObject({ billed_hours: null, billed_amount: null, billed_rule: { minutes: 30, direction: 'up' } });
    expect(body.find((e) => e.description === 'E65').billed_hours).toBe('1.50');
  });

  test('a customer with an own rule can not be deleted while its timer runs, and keeps its rule', async () => {
    await setCustomer(eigen, 30, 'up');
    const project = (await mockPool.query('SELECT id FROM projects WHERE customer_id = $1', [eigen])).rows[0].id;
    await mockPool.query('INSERT INTO time_entries (project_id, start_time) VALUES ($1, $2)', [project, '2026-09-22 09:00:00']);

    const { status } = await request('DELETE', `/api/customers/${eigen}`);

    expect(status).toBe(409);
    expect((await request('GET', '/api/customers')).body.find((c) => c.id === eigen).rounding_minutes).toBe(30);
  });

  test('a customer with an own rule can be deleted without a timer, and the other customer is untouched', async () => {
    await setCustomer(eigen, 30, 'up');

    const { status } = await request('DELETE', `/api/customers/${eigen}`);

    expect(status).toBe(200);
    expect((await request('GET', '/api/customers')).body.map((c) => c.name)).toEqual(['Muster']);
  });

  test('the JSON report of an unknown customer is still an empty report with the global rule', async () => {
    await setGlobal(15, 'up');

    const { status, body } = await request('GET', '/api/reports/customer/99999?month=9&year=2026&tz=UTC');

    expect(status).toBe(200);
    expect(body.entries).toEqual([]);
    expect(body.rounding).toEqual({ minutes: 15, direction: 'up' });
  });

  test('the JSON report of an empty month names the own rule of the customer', async () => {
    await setGlobal(15, 'up');
    await setCustomer(eigen, 30, 'nearest');

    const { body } = await request('GET', `/api/reports/customer/${eigen}?month=1&year=2020&tz=UTC`);

    expect(body.rounding).toEqual({ minutes: 30, direction: 'nearest' });
  });

  test('the JSON report of an empty month names no rule for a customer set to no rounding', async () => {
    await setGlobal(15, 'up');
    await setCustomer(eigen, 0, 'up');

    const { body } = await request('GET', `/api/reports/customer/${eigen}?month=1&year=2020&tz=UTC`);

    expect(body).not.toHaveProperty('rounding');
  });
});
