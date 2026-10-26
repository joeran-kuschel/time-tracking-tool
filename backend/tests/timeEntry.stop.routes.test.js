const fs = require('fs');
const path = require('path');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));
jest.mock('../src/models/Session');

const { createTestPool } = require('./helpers/testDb');
const Session = require('../src/models/Session');
const { createApp } = require('../src/app');

const LOGGED_IN = { Cookie: 'session=abc' };
const NOW = new Date('2026-09-21T10:00:00Z');
let server;
let baseUrl;
let customerId;
let entryId;
let projectId;

const patch = (body) =>
  fetch(`${baseUrl}/api/time-entries/${entryId}`, {
    method: 'PATCH',
    headers: { ...LOGGED_IN, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

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
  projectId = (await mockPool.query("INSERT INTO projects (customer_id, name, hourly_rate) VALUES ($1, 'Website', 80) RETURNING id", [customerId])).rows[0].id;
  entryId = (await mockPool.query(
    "INSERT INTO time_entries (project_id, start_time) VALUES ($1, '2026-09-21 08:00:00') RETURNING id",
    [projectId]
  )).rows[0].id;

  // Only Date is faked, so the HTTP server and fetch keep working
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'queueMicrotask', 'performance', 'hrtime'],
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('PATCH /api/time-entries/:id (stopping)', () => {
  test('stores the server time when the browser sends an end before the start, so the report has no negative hours', async () => {
    const response = await patch({ endTime: '2026-09-21T07:00:00Z' });
    const stored = (await mockPool.query('SELECT start_time, end_time FROM time_entries WHERE id = $1', [entryId])).rows[0];

    expect(response.status).toBe(200);
    expect(new Date((await response.json()).end_time).getTime()).toBe(NOW.getTime());
    expect(new Date(stored.end_time).getTime()).toBeGreaterThan(new Date(stored.start_time).getTime());

    const report = await (await fetch(`${baseUrl}/api/reports/customer/${customerId}?month=9&year=2026&tz=UTC`, { headers: LOGGED_IN })).json();
    expect(Number(report.totalHours)).toBe(2);
  });

  test('stores the sent end when it is after the start', async () => {
    const response = await patch({ endTime: '2026-09-21T09:30:00Z' });

    expect(response.status).toBe(200);
    expect(new Date((await response.json()).end_time).getTime()).toBe(new Date('2026-09-21T09:30:00Z').getTime());
  });

  const stored = async () => (await mockPool.query('SELECT start_time, end_time, description FROM time_entries WHERE id = $1', [entryId])).rows[0];

  test('stores the sent end 1 ms after the start, and the server time for 1 ms before', async () => {
    const after = await patch({ endTime: '2026-09-21T08:00:00.001Z' });
    expect(new Date((await after.json()).end_time).getTime()).toBe(new Date('2026-09-21T08:00:00.001Z').getTime());

    await mockPool.query('UPDATE time_entries SET end_time = NULL WHERE id = $1', [entryId]);
    const before = await patch({ endTime: '2026-09-21T07:59:59.999Z' });
    expect(new Date((await before.json()).end_time).getTime()).toBe(NOW.getTime());
  });

  test('stores end = start (0 hours) when the start is in the future', async () => {
    await mockPool.query("UPDATE time_entries SET start_time = '2026-09-21 12:00:00' WHERE id = $1", [entryId]);

    const response = await patch({ endTime: '2026-09-21T09:00:00Z' });
    const row = await stored();

    expect(response.status).toBe(200);
    expect(new Date(row.end_time).getTime()).toBe(new Date(row.start_time).getTime());
  });

  test('keeps a sent end in the future as sent', async () => {
    const response = await patch({ endTime: '2026-09-21T18:00:00Z' });
    expect(new Date((await response.json()).end_time).getTime()).toBe(new Date('2026-09-21T18:00:00Z').getTime());
  });

  test('accepts a date-only end that lies before the start by replacing it with the server time', async () => {
    const response = await patch({ endTime: '2026-09-20' });
    expect(new Date((await response.json()).end_time).getTime()).toBe(NOW.getTime());
  });

  test('saves the description together with a corrected end', async () => {
    await patch({ endTime: '2026-09-21T07:00:00Z', description: 'Review' });
    const row = await stored();

    expect(row.description).toBe('Review');
    expect(new Date(row.end_time).getTime()).toBe(NOW.getTime());
  });

  test('a second stop edits the now finished entry and refuses an end before the start with 400', async () => {
    await patch({ endTime: '2026-09-21T09:00:00Z' });
    const second = await patch({ endTime: '2026-09-21T07:00:00Z' });

    expect(second.status).toBe(400);
    expect(new Date((await stored()).end_time).getTime()).toBe(new Date('2026-09-21T09:00:00Z').getTime());
  });

  test('editing a finished entry with an end before the start still answers 400', async () => {
    await mockPool.query("UPDATE time_entries SET end_time = '2026-09-21 09:00:00' WHERE id = $1", [entryId]);
    expect((await patch({ endTime: '2026-09-21T08:00:00Z' })).status).toBe(400);
  });

  test('still answers 409 for changing the start or project of a running entry', async () => {
    const response = await patch({ endTime: '2026-09-21T09:00:00Z', startTime: '2026-09-21T07:00:00Z' });
    expect(response.status).toBe(409);
    expect((await stored()).end_time).toBeNull();
  });

  test('answers 404 for an unknown entry and 400 without an end', async () => {
    entryId = 9999;
    expect((await patch({ endTime: '2026-09-21T09:00:00Z' })).status).toBe(404);
    expect((await patch({})).status).toBe(400);
  });

  test('the psql query in the documentation runs against the schema and finds old bad entries only', async () => {
    const docs = fs.readFileSync(path.join(__dirname, '..', '..', 'documentation', 'backend', 'time-entries.md'), 'utf8');
    const sql = docs.match(/-c "(SELECT te\.id[^"]*)"/)[1];
    await mockPool.query("INSERT INTO time_entries (project_id, start_time, end_time) VALUES ($1, '2026-09-20 10:00:00', '2026-09-20 09:00:00')", [projectId]);
    await mockPool.query("INSERT INTO time_entries (project_id, start_time, end_time) VALUES ($1, '2026-09-20 10:00:00', '2026-09-20 11:00:00')", [projectId]);

    const { rows } = await mockPool.query(sql);

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Website');
  });
});

// end_time is TIMESTAMP WITHOUT TIME ZONE: the offset of a sent time must be turned into the UTC instant first
describe('times with a UTC offset', () => {
  const stored = async () => (await mockPool.query('SELECT start_time, end_time FROM time_entries WHERE id = $1', [entryId])).rows[0];
  const iso = (value) => new Date(value).toISOString();
  const send = (method, path, body) =>
    fetch(`${baseUrl}/api/time-entries${path}`, {
      method,
      headers: { ...LOGGED_IN, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  test('stop: an end after the start by instant is stored as that UTC instant', async () => {
    expect((await patch({ endTime: '2026-09-21T07:30:00-02:00' })).status).toBe(200);
    expect(iso((await stored()).end_time)).toBe('2026-09-21T09:30:00.000Z');
  });

  test('stop: an end before the start by instant is replaced by the server time', async () => {
    // 09:30+02:00 is 07:30Z, before the 08:00Z start
    expect((await patch({ endTime: '2026-09-21T09:30:00+02:00' })).status).toBe(200);
    expect(iso((await stored()).end_time)).toBe(NOW.toISOString());
  });

  test('edit: start and end are stored as UTC instants', async () => {
    await patch({ endTime: '2026-09-21T09:00:00Z' });
    const response = await patch({ startTime: '2026-09-21T09:00:00+02:00', endTime: '2026-09-21T10:30:00+02:00' });

    expect(response.status).toBe(200);
    expect(iso((await stored()).start_time)).toBe('2026-09-21T07:00:00.000Z');
    expect(iso((await stored()).end_time)).toBe('2026-09-21T08:30:00.000Z');
  });

  test('edit: an end before the start by instant is refused and nothing changes', async () => {
    await patch({ endTime: '2026-09-21T09:00:00Z' });
    // 09:30+02:00 is 07:30Z, before the 08:00Z start, although 09:30 looks later than 09:00
    const response = await patch({ endTime: '2026-09-21T09:30:00+02:00' });

    expect(response.status).toBe(400);
    expect(iso((await stored()).end_time)).toBe('2026-09-21T09:00:00.000Z');
  });

  test('create: times are stored as UTC instants', async () => {
    const response = await send('POST', '', {
      projectId: 1, startTime: '2026-09-22T09:00:00+02:00', endTime: '2026-09-22T11:00:00+02:00',
    });
    const row = (await mockPool.query('SELECT start_time, end_time FROM time_entries WHERE id = $1', [(await response.json()).id])).rows[0];

    expect(response.status).toBe(201);
    expect(iso(row.start_time)).toBe('2026-09-22T07:00:00.000Z');
    expect(iso(row.end_time)).toBe('2026-09-22T09:00:00.000Z');
  });

  test('create: an end before the start by instant is refused', async () => {
    const response = await send('POST', '', {
      projectId: 1, startTime: '2026-09-22T09:00:00Z', endTime: '2026-09-22T10:30:00+02:00',
    });

    expect(response.status).toBe(400);
  });
});
