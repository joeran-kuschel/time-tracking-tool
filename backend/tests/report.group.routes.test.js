const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));
jest.mock('../src/models/Session');

const Session = require('../src/models/Session');
const { createApp } = require('../src/app');

// The reports with group=task, on the real schema: one task worked on in several blocks, with a call in between
const LOGGED_IN = { Cookie: 'session=abc' };
let server;
let baseUrl;
let customerId;

const get = (format, query) => fetch(`${baseUrl}/api/reports/customer/${customerId}${format}?${query}`, { headers: LOGGED_IN });
const csvLines = async (response) => Buffer.from(await response.arrayBuffer()).toString('utf8').slice(1).split('\r\n');

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
  const projectId = (await mockPool.query("INSERT INTO projects (customer_id, name, hourly_rate) VALUES ($1, 'Website', 80) RETURNING id", [customerId])).rows[0].id;
  await mockPool.query(
    `INSERT INTO time_entries (project_id, start_time, end_time, description, task) VALUES
      ($1, '2026-09-21 08:00:00', '2026-09-21 08:30:00', 'review', 'Fix login'),
      ($1, '2026-09-21 09:00:00', '2026-09-21 09:20:00', 'call', NULL),
      ($1, '2026-09-21 10:00:00', '2026-09-21 10:10:00', 'redirect', 'fix LOGIN'),
      ($1, '2026-09-22 08:00:00', '2026-09-22 08:15:00', 'review', 'Fix login')`,
    [projectId]
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET /api/reports/customer/:id with group=task', () => {
  test('sums the hours of a day and task into one row; the total stays the same', async () => {
    const detailed = await (await get('', 'month=9&year=2026&tz=UTC')).json();
    const grouped = await (await get('', 'month=9&year=2026&tz=UTC&group=task')).json();

    expect(detailed.entries).toHaveLength(4);
    expect(grouped.entries).toHaveLength(3);
    const sum = grouped.entries.find((entry) => entry.count === 2);
    expect(sum).toMatchObject({ task: 'Fix login', details: ['review', 'redirect'] });
    expect((new Date(sum.end_time) - new Date(sum.start_time)) / 60000).toBe(40);
    expect(grouped.totalHours).toBe(detailed.totalHours);
  });

  test('without group the entries are as before, with their task', async () => {
    const report = await (await get('', 'month=9&year=2026&tz=UTC')).json();

    expect(report.entries.map((entry) => entry.task).sort()).toEqual(['Fix login', 'Fix login', 'fix LOGIN', null]);
    expect(report.entries[0].details).toBeUndefined();
  });

  test('rounds once per summed row', async () => {
    await mockPool.query('INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
    await mockPool.query("UPDATE settings SET rounding_minutes = 15, rounding_direction = 'up' WHERE id = 1");

    const detailed = await (await get('', 'month=9&year=2026&tz=UTC')).json();
    const grouped = await (await get('', 'month=9&year=2026&tz=UTC&group=task')).json();

    // 30, 20, 10 and 15 minutes: 30 + 30 + 15 + 15 rounded one by one; 45 (the 40 minutes of the task) + 30 + 15 as rows
    expect(detailed.totalHours).toBe('1.50');
    expect(grouped.entries.find((entry) => entry.count === 2).billed_hours).toBe('0.75');
    expect(grouped.entries.map((entry) => entry.billed_hours).sort()).toEqual(['0.25', '0.50', '0.75']);
  });

  test('answers 400 for another value of group', async () => {
    for (const query of ['group=day', 'group=task&group=task']) {
      const response = await get('', `month=9&year=2026&${query}`);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'group must be task' });
    }
  });
});

describe('GET /api/reports/customer/:id/csv with group=task', () => {
  test('has no start and end, but a task column, and the details in the description', async () => {
    const response = await get('/csv', 'month=9&year=2026&tz=UTC&lang=en&group=task');

    expect(response.status).toBe(200);
    expect(await csvLines(response)).toEqual([
      'Date,Customer,Project,Task,Description,Hours',
      '2026-09-22,Muster GmbH,Website,Fix login,review,0.25',
      '2026-09-21,Muster GmbH,Website,Fix login,review; redirect,0.67',
      '2026-09-21,Muster GmbH,Website,,call,0.33',
      '',
    ]);
  });

  test('keeps the columns of the detailed CSV without group', async () => {
    const lines = await csvLines(await get('/csv', 'month=9&year=2026&tz=UTC&lang=en'));

    expect(lines[0]).toBe('Date,Start,End,Customer,Project,Description,Hours');
  });

  test('answers 400 for another value of group', async () => {
    expect((await get('/csv', 'month=9&year=2026&group=x')).status).toBe(400);
  });
});

describe('GET /api/reports/customer/:id/pdf with group=task', () => {
  test('makes a PDF, and answers 400 for another value of group', async () => {
    const ok = await get('/pdf', 'month=9&year=2026&tz=UTC&lang=en&group=task');
    const bad = await get('/pdf', 'month=9&year=2026&group=x');

    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('application/pdf');
    expect(bad.status).toBe(400);
  });
});

describe('group=task with amounts=1', () => {
  test('the CSV has Task, Hours, Rate and Amount; the amount of a summed row follows its summed minutes', async () => {
    const lines = await csvLines(await get('/csv', 'month=9&year=2026&tz=UTC&lang=en&group=task&amounts=1'));

    expect(lines).toEqual([
      'Date,Customer,Project,Task,Description,Hours,Rate (EUR/h),Amount (EUR)',
      '2026-09-22,Muster GmbH,Website,Fix login,review,0.25,80.00,20.00',
      '2026-09-21,Muster GmbH,Website,Fix login,review; redirect,0.67,80.00,53.33',
      '2026-09-21,Muster GmbH,Website,,call,0.33,80.00,26.67',
      '',
    ]);
  });

  test('the total amount of the grouped CSV is the total of the detailed one when nothing is rounded', async () => {
    const amountsOf = async (query) => (await csvLines(await get('/csv', `month=9&year=2026&tz=UTC&lang=en&amounts=1${query}`)))
      .slice(1, -1).reduce((sum, line) => sum + Number(line.split(',').at(-1)), 0);

    expect((await amountsOf('&group=task')).toFixed(2)).toBe((await amountsOf('')).toFixed(2));
  });

  test('the JSON report and the PDF accept both parameters together', async () => {
    const json = await get('', 'month=9&year=2026&tz=UTC&group=task&amounts=1');
    const pdf = await get('/pdf', 'month=9&year=2026&tz=UTC&group=task&amounts=1');

    expect(json.status).toBe(200);
    expect(pdf.status).toBe(200);
  });

  test('a month without entries gives an empty grouped report', async () => {
    const report = await (await get('', 'month=10&year=2026&tz=UTC&group=task')).json();

    expect(report.entries).toEqual([]);
    expect(report.totalHours).toBe('0.00');
  });

  test('the month limits follow tz: an entry at 23:30 UTC on 30 September is in October in Berlin', async () => {
    const projectId = (await mockPool.query('SELECT id FROM projects LIMIT 1')).rows[0].id;
    await mockPool.query("INSERT INTO time_entries (project_id, start_time, end_time, task) VALUES ($1, '2026-09-30 23:30:00', '2026-09-30 23:40:00', 'Fix login')", [projectId]);

    const october = await (await get('', 'month=10&year=2026&tz=Europe/Berlin&group=task')).json();

    expect(october.entries).toHaveLength(1);
  });
});
