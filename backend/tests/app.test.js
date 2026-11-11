jest.mock('../src/models/Customer');
jest.mock('../src/models/Session');
jest.mock('../src/models/Settings');

const Customer = require('../src/models/Customer');
const Session = require('../src/models/Session');
const Settings = require('../src/models/Settings');
const { createApp, parseOrigins } = require('../src/app');

const FRONTEND = 'http://localhost';
const LOGGED_IN = { Cookie: 'session=abc' };
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
  Session.findUser.mockResolvedValue({ id: 1, email: 'me@example.com' });
  Customer.create.mockResolvedValue({ id: 1, name: 'Muster' });
  Customer.delete.mockResolvedValue({ id: 1 });
});

describe('CORS', () => {
  test('lets the frontend\'s origin read answers and the download file name', async () => {
    const response = await fetch(`${baseUrl}/health`, { headers: { Origin: FRONTEND } });

    expect(response.headers.get('access-control-allow-origin')).toBe(FRONTEND);
    expect(response.headers.get('access-control-expose-headers')).toBe('Content-Disposition');
  });

  test('lets the frontend send the login cookie', async () => {
    const response = await fetch(`${baseUrl}/health`, { headers: { Origin: FRONTEND } });

    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
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
      headers: { 'Content-Type': 'application/json', ...LOGGED_IN },
      body: JSON.stringify({ name: 'Muster' }),
    });

    expect(response.status).toBe(201);
    expect(Customer.create).toHaveBeenCalledWith('Muster', null);
  });

  test('ignores form data, which other sites can send without a CORS check', async () => {
    const response = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...LOGGED_IN },
      body: 'name=Spam',
    });

    expect(response.status).toBe(400);
    expect(Customer.create).not.toHaveBeenCalled();
  });

  test('refuses a change that comes from a page on another origin, even with a valid session', async () => {
    const response = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://evil.example', ...LOGGED_IN },
      body: 'name=Spam',
    });

    expect(response.status).toBe(403);
    expect(Customer.create).not.toHaveBeenCalled();
  });

  test('accepts a change from the frontend\'s origin', async () => {
    const response = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: FRONTEND, ...LOGGED_IN },
      body: JSON.stringify({ name: 'Muster' }),
    });

    expect(response.status).toBe(201);
  });
});

describe('settings', () => {
  const send = (method, body, headers = {}) => fetch(`${baseUrl}/api/settings`, {
    method,
    headers: { 'Content-Type': 'application/json', ...LOGGED_IN, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  test('GET answers with the settings of a logged-in user', async () => {
    Settings.get.mockResolvedValue({});

    const response = await send('GET');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
  });

  test('PUT saves and answers with all settings', async () => {
    Settings.update.mockResolvedValue({});

    const response = await send('PUT', {});

    expect(response.status).toBe(200);
    expect(Settings.update).toHaveBeenCalledWith({});
  });

  test('PUT with an unknown setting answers 400 and saves nothing', async () => {
    const response = await send('PUT', { rounding: 15 });

    expect(response.status).toBe(400);
    expect(Settings.update).not.toHaveBeenCalled();
  });

  test('PUT with a JSON array answers 400', async () => {
    expect((await send('PUT', [])).status).toBe(400);
  });

  test('PUT from another origin is refused', async () => {
    const response = await send('PUT', {}, { Origin: 'https://evil.example' });

    expect(response.status).toBe(403);
    expect(Settings.update).not.toHaveBeenCalled();
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
