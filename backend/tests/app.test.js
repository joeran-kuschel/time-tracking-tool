jest.mock('../src/models/Customer');

const Customer = require('../src/models/Customer');
const { createApp, parseOrigins } = require('../src/app');

const FRONTEND = 'http://localhost';
let server;
let baseUrl;

beforeAll((done) => {
  server = createApp({ corsOrigins: [FRONTEND, 'http://localhost:5173'] }).listen(0, () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

beforeEach(() => {
  jest.clearAllMocks();
  Customer.create.mockResolvedValue({ id: 1, name: 'Muster' });
  Customer.delete.mockResolvedValue({ id: 1 });
});

describe('CORS', () => {
  test('lets the frontend\'s origin read answers and the download file name', async () => {
    const response = await fetch(`${baseUrl}/health`, { headers: { Origin: FRONTEND } });

    expect(response.headers.get('access-control-allow-origin')).toBe(FRONTEND);
    expect(response.headers.get('access-control-expose-headers')).toBe('Content-Disposition');
  });

  test('gives other origins no permission to read answers', async () => {
    const response = await fetch(`${baseUrl}/health`, { headers: { Origin: 'https://evil.example' } });

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('allows a DELETE from the frontend in the preflight, but not from other origins', async () => {
    const preflight = (origin) => fetch(`${baseUrl}/api/customers/1`, {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'DELETE' },
    });

    expect((await preflight(FRONTEND)).headers.get('access-control-allow-origin')).toBe(FRONTEND);
    expect((await preflight('https://evil.example')).headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('request bodies', () => {
  test('reads JSON', async () => {
    const response = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Muster' }),
    });

    expect(response.status).toBe(201);
    expect(Customer.create).toHaveBeenCalledWith('Muster', null);
  });

  test('ignores form data, which other sites can send without a CORS check', async () => {
    const response = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://evil.example' },
      body: 'name=Spam',
    });

    expect(response.status).toBe(400);
    expect(Customer.create).not.toHaveBeenCalled();
  });
});

describe('parseOrigins', () => {
  test('splits a comma-separated list and trims it', () => {
    expect(parseOrigins(' http://localhost , https://zeit.example.de ')).toEqual(['http://localhost', 'https://zeit.example.de']);
  });

  test.each([undefined, '', ' , '])('has no origins for %p', (value) => {
    expect(parseOrigins(value)).toEqual([]);
  });
});
