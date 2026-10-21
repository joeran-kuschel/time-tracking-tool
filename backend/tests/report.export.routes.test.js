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
let customerId;

const get = (query, headers = LOGGED_IN) =>
  fetch(`${baseUrl}/api/reports/customer/${customerId}/csv?${query}`, { headers });

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
    `INSERT INTO time_entries (project_id, start_time, end_time, description) VALUES
      ($1, '2026-09-21 08:00:00', '2026-09-21 09:30:00', 'Konzept; "Phase 1"'),
      ($1, '2026-09-22 08:00:00', NULL, '=SUM(A1)')`,
    [projectId]
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET /api/reports/customer/:id/csv', () => {
  test('answers 401 without a login', async () => {
    const response = await get('month=9&year=2026', {});

    expect(response.status).toBe(401);
  });

  test('downloads the month as a German CSV with BOM, header and rows', async () => {
    const response = await get('month=9&year=2026&lang=de');
    // response.text() would strip the BOM, so read the bytes
    const bytes = Buffer.from(await response.arrayBuffer());
    const body = bytes.toString('utf8');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="abrechnung-Muster GmbH-2026-9.csv"');
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(body.slice(1).split('\r\n')).toEqual([
      'Datum;Beginn;Ende;Kunde;Projekt;Beschreibung;Stunden',
      "2026-09-22;08:00;;Muster GmbH;Website;'=SUM(A1);0,00",
      '2026-09-21;08:00;09:30;Muster GmbH;Website;"Konzept; ""Phase 1""";1,50',
      '',
    ]);
  });

  test('downloads the English CSV with commas and decimal points', async () => {
    const response = await get('month=9&year=2026&lang=en');
    const lines = Buffer.from(await response.arrayBuffer()).toString('utf8').slice(1).split('\r\n');

    expect(response.headers.get('content-disposition')).toBe('attachment; filename="time-report-Muster GmbH-2026-9.csv"');
    expect(lines[0]).toBe('Date,Start,End,Customer,Project,Description,Hours');
    expect(lines[2]).toBe('2026-09-21,08:00,09:30,Muster GmbH,Website,"Konzept; ""Phase 1""",1.50');
  });

  test('answers 400 for an invalid month', async () => {
    const response = await get('month=13&year=2026');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'month (1-12) and year are required' });
  });

  test('answers 404 for a month without entries', async () => {
    const response = await get('month=8&year=2026');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'No time entries found for the specified month' });
  });

  describe('edge cases', () => {
    const lines = async (response) => Buffer.from(await response.arrayBuffer()).toString('utf8').slice(1).split('\r\n');
    const addEntry = async (customer, start, end, description, projectName = 'Edge') => {
      const projectId = (await mockPool.query('INSERT INTO projects (customer_id, name, hourly_rate) VALUES ($1, $2, 80) RETURNING id', [customer, projectName])).rows[0].id;
      await mockPool.query('INSERT INTO time_entries (project_id, start_time, end_time, description) VALUES ($1, $2, $3, $4)', [projectId, start, end, description]);
    };

    test('puts an entry from New Year\'s Eve into January in a time zone ahead of UTC, and into December without one', async () => {
      await addEntry(customerId, '2026-12-31 23:30:00', '2026-12-31 23:45:00', 'Silvester');

      const january = await lines(await get('month=1&year=2027&lang=en&tz=Europe%2FBerlin'));
      const december = await lines(await get('month=12&year=2026&lang=en'));

      expect(january[1]).toBe('2027-01-01,00:30,00:45,Muster GmbH,Edge,Silvester,0.25');
      expect(december).toContain('2026-12-31,23:30,23:45,Muster GmbH,Edge,Silvester,0.25');
      expect((await get('month=1&year=2027&lang=en')).status).toBe(404);
    });

    test('excludes the entry that starts at the end of the month in the time zone', async () => {
      await addEntry(customerId, '2026-09-30 22:00:00', '2026-09-30 23:00:00', 'Next month');

      const september = await lines(await get('month=9&year=2026&lang=en&tz=Europe%2FBerlin'));

      expect(september).toHaveLength(4);
      expect(september.join('\n')).not.toContain('Next month');
    });

    test('falls back to UTC for an invalid time zone and to German for an unknown language', async () => {
      const response = await get('month=9&year=2026&lang=fr&tz=Not%2FAZone');
      const body = await lines(response);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-disposition')).toContain('abrechnung-');
      expect(body[0]).toBe('Datum;Beginn;Ende;Kunde;Projekt;Beschreibung;Stunden');
      expect(body[2]).toContain('2026-09-21;08:00;09:30;');
    });

    test('contains only the entries of the requested customer', async () => {
      const other = (await mockPool.query("INSERT INTO customers (name) VALUES ('Andere AG') RETURNING id")).rows[0].id;
      await addEntry(other, '2026-09-23 08:00:00', '2026-09-23 10:00:00', 'fremd');

      const body = (await lines(await get('month=9&year=2026&lang=en'))).join('\n');

      expect(body).not.toContain('fremd');
      expect(body).not.toContain('Andere AG');
    });

    test('keeps a multi-line and a very long description in one field', async () => {
      const long = 'x'.repeat(5000);
      await addEntry(customerId, '2026-09-24 08:00:00', '2026-09-24 09:00:00', `Zeile 1\nZeile 2\r\n${long}`);

      const body = Buffer.from(await (await get('month=9&year=2026&lang=en')).arrayBuffer()).toString('utf8');

      expect(body).toContain(`"Zeile 1\nZeile 2\r\n${long}"`);
    });

    test.each([
      ['a leading tab', '\tBeschreibung', "'\tBeschreibung"],
      ['a leading minus', '-5 Stunden', "'-5 Stunden"],
      ['an at sign', '@team', "'@team"],
      ['only spaces', '   ', '   '],
    ])('writes a description with %s as plain text', async (_name, description, written) => {
      await addEntry(customerId, '2026-09-25 08:00:00', '2026-09-25 09:00:00', description);

      const body = (await lines(await get('month=9&year=2026&lang=en'))).find((line) => line.startsWith('2026-09-25'));

      expect(body).toBe(`2026-09-25,08:00,09:00,Muster GmbH,Edge,${written},1.00`);
    });

    test('protects a customer and a project name that look like formulas', async () => {
      const evil = (await mockPool.query("INSERT INTO customers (name) VALUES ('=HYPERLINK(1)') RETURNING id")).rows[0].id;
      await addEntry(evil, '2026-09-26 08:00:00', '2026-09-26 09:00:00', 'x', '+cmd');

      const response = await fetch(`${baseUrl}/api/reports/customer/${evil}/csv?month=9&year=2026&lang=en`, { headers: LOGGED_IN });

      expect((await lines(response))[1]).toBe("2026-09-26,08:00,09:00,'=HYPERLINK(1),'+cmd,x,1.00");
    });

    test('writes an empty description as an empty field', async () => {
      await addEntry(customerId, '2026-09-27 08:00:00', '2026-09-27 09:00:00', '');

      const body = (await lines(await get('month=9&year=2026&lang=en'))).find((line) => line.startsWith('2026-09-27'));

      expect(body).toBe('2026-09-27,08:00,09:00,Muster GmbH,Edge,,1.00');
    });

    test('answers 404 for an unknown customer', async () => {
      const response = await fetch(`${baseUrl}/api/reports/customer/99999/csv?month=9&year=2026`, { headers: LOGGED_IN });

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Customer not found' });
    });
  });
});
