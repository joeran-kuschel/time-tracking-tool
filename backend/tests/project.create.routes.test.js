const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));
jest.mock('../src/models/Session');

const Session = require('../src/models/Session');
const { createApp } = require('../src/app');

const LOGGED_IN = { Cookie: 'session=abc', 'Content-Type': 'application/json' };
let server;
let baseUrl;

const post = (body) =>
  fetch(`${baseUrl}/api/projects`, { method: 'POST', headers: LOGGED_IN, body: JSON.stringify(body) });
const countProjects = async () => Number((await mockPool.query('SELECT COUNT(*) AS n FROM projects')).rows[0].n);

beforeAll((done) => {
  server = createApp({ corsOrigins: [] }).listen(0, () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

beforeEach(() => {
  mockPool = createTestPool();
  Session.findUser.mockResolvedValue({ id: 1, email: 'me@example.com' });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /api/projects', () => {
  test('creates a project for an existing customer', async () => {
    const { rows } = await mockPool.query("INSERT INTO customers (name) VALUES ('Kunde') RETURNING id");

    const response = await post({ customerId: rows[0].id, name: 'Website', hourlyRate: 80 });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ customer_id: rows[0].id, name: 'Website' });
    expect(await countProjects()).toBe(1);
  });

  test('answers 400 and stores nothing for a customer that does not exist', async () => {
    const response = await post({ customerId: 999, name: 'Website', hourlyRate: 80 });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Customer not found' });
    expect(await countProjects()).toBe(0);
  });

  test('answers 400 for a customer that was deleted', async () => {
    const { rows } = await mockPool.query("INSERT INTO customers (name) VALUES ('Kunde') RETURNING id");
    await mockPool.query('DELETE FROM customers WHERE id = $1', [rows[0].id]);

    const response = await post({ customerId: rows[0].id, name: 'Website' });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Customer not found' });
  });

  test('checks required fields before looking the customer up', async () => {
    const response = await post({ customerId: 999 });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'customerId and name are required' });
  });

  test.each([['abc'], ['1e0'], ['0x10'], [true], [[1]], [99999999999], [1.5]])(
    'answers 400 and stores nothing for the customerId %p',
    async (customerId) => {
      const response = await post({ customerId, name: 'Website' });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Customer not found' });
      expect(await countProjects()).toBe(0);
    }
  );
});
