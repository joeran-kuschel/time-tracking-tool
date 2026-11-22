jest.mock('../src/models/Customer');
jest.mock('../src/models/Session');
jest.mock('../src/models/Settings');
jest.mock('../src/models/Logo');

const Customer = require('../src/models/Customer');
const Session = require('../src/models/Session');
const Settings = require('../src/models/Settings');
const Logo = require('../src/models/Logo');
const { png, upload } = require('./helpers/images');
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
    expect(Customer.create).toHaveBeenCalledWith('Muster', null, undefined, undefined);
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

  test.each([true, false])('PUT saves showAmounts %p and answers with the stored settings', async (value) => {
    Settings.update.mockResolvedValue({ showAmounts: value });

    const response = await send('PUT', { showAmounts: value });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ showAmounts: value });
    expect(Settings.update).toHaveBeenCalledWith({ showAmounts: value });
  });

  test.each(['true', 1, null, {}])('PUT with showAmounts %p answers 400 and saves nothing', async (value) => {
    const response = await send('PUT', { showAmounts: value });

    expect(response.status).toBe(400);
    expect(Settings.update).not.toHaveBeenCalled();
  });

  test.each([
    [{ roundingMinutes: 0 }], [{ roundingMinutes: 5 }], [{ roundingMinutes: 10 }], [{ roundingMinutes: 15 }], [{ roundingMinutes: 30 }], [{ roundingMinutes: 60 }],
    [{ roundingDirection: 'up' }], [{ roundingDirection: 'nearest' }],
    [{ showRoundingNote: true }], [{ showRoundingNote: false }],
    [{ roundingMinutes: 15, roundingDirection: 'nearest', showRoundingNote: true }],
  ])('PUT saves the rounding setting %j', async (change) => {
    Settings.update.mockResolvedValue(change);

    const response = await send('PUT', change);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(change);
    expect(Settings.update).toHaveBeenCalledWith(change);
  });

  test.each([
    [{ roundingMinutes: 20 }], [{ roundingMinutes: 45 }], [{ roundingMinutes: 120 }], [{ roundingMinutes: -15 }], [{ roundingMinutes: '15' }], [{ roundingMinutes: 15.5 }],
    [{ roundingMinutes: null }], [{ roundingDirection: 'down' }], [{ roundingDirection: 'UP' }], [{ roundingDirection: 15 }],
    [{ showRoundingNote: 'true' }], [{ showRoundingNote: 1 }],
    [{ roundingMinutes: 15, roundingDirection: 'sideways' }],
  ])('PUT with the invalid rounding setting %j answers 400 and saves nothing', async (change) => {
    const response = await send('PUT', change);

    expect(response.status).toBe(400);
    expect(Settings.update).not.toHaveBeenCalled();
  });

  test.each([[{ weekStart: 'sunday' }], [{ weekStart: 'monday' }]])('PUT saves the first day of the week %j', async (change) => {
    Settings.update.mockResolvedValue(change);

    const response = await send('PUT', change);

    expect(response.status).toBe(200);
    expect(Settings.update).toHaveBeenCalledWith(change);
  });

  test.each([['friday'], [''], [null], [0]])('PUT with the first day of the week %j answers 400 and saves nothing', async (value) => {
    const response = await send('PUT', { weekStart: value });

    expect(response.status).toBe(400);
    expect(Settings.update).not.toHaveBeenCalled();
  });

  test.each([[{ defaultHourlyRate: 80 }], [{ defaultHourlyRate: 0 }], [{ defaultHourlyRate: null }]])('PUT saves the default rate %j', async (change) => {
    Settings.update.mockResolvedValue(change);

    const response = await send('PUT', change);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(change);
    expect(Settings.update).toHaveBeenCalledWith(change);
  });

  test.each([[-1], ['80'], [80.555], [1e8]])('PUT with the default rate %j answers 400 and saves nothing', async (value) => {
    const response = await send('PUT', { defaultHourlyRate: value });

    expect(response.status).toBe(400);
    expect(Settings.update).not.toHaveBeenCalled();
  });

  test('PUT with a valid and an unknown setting saves neither', async () => {
    const response = await send('PUT', { showAmounts: true, rounding: 15 });

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

describe('the logo', () => {
  const logoRequest = (method, body, headers = {}) => fetch(`${baseUrl}/api/settings/logo`, {
    method,
    headers: { 'Content-Type': 'application/json', ...LOGGED_IN, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  test('PUT stores an image whose JSON body is far larger than the default limit of 100 kB', async () => {
    const big = Buffer.concat([png(4, 2), Buffer.alloc(900 * 1024)]);

    const response = await logoRequest('PUT', upload('image/png', big));

    expect(response.status).toBe(200);
    expect(Logo.set).toHaveBeenCalledWith('image/png', big);
  });

  test('PUT of a body above 1.5 MB answers 413 and stores nothing', async () => {
    const response = await logoRequest('PUT', { contentType: 'image/png', data: 'A'.repeat(1.6 * 1024 * 1024) });

    expect(response.status).toBe(413);
    expect(Logo.set).not.toHaveBeenCalled();
  });

  test('every other route keeps the small body limit', async () => {
    const response = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...LOGGED_IN },
      body: JSON.stringify({ name: 'x'.repeat(200 * 1024) }),
    });

    expect(response.status).toBe(413);
    expect(Customer.create).not.toHaveBeenCalled();
  });

  test('the settings route keeps it too', async () => {
    const response = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...LOGGED_IN },
      body: JSON.stringify({ senderName: 'x'.repeat(200 * 1024) }),
    });

    expect(response.status).toBe(413);
  });

  test.each([['GET'], ['PUT'], ['DELETE']])('%s needs a login, and a large body is not read without one', async (method) => {
    Session.findUser.mockResolvedValue(null);
    const body = method === 'PUT' ? upload('image/png', Buffer.concat([png(), Buffer.alloc(500 * 1024)])) : undefined;

    const response = await logoRequest(method, body, { Cookie: '' });

    expect(response.status).toBe(401);
    expect(Logo.get).not.toHaveBeenCalled();
    expect(Logo.set).not.toHaveBeenCalled();
    expect(Logo.remove).not.toHaveBeenCalled();
  });

  test('PUT refuses a request from another origin', async () => {
    const response = await logoRequest('PUT', upload('image/png', png()), { Origin: 'https://evil.example' });

    expect(response.status).toBe(403);
    expect(Logo.set).not.toHaveBeenCalled();
  });

  test('GET sends the stored image with its type, nosniff and no caching', async () => {
    const image = png(40, 20);
    Logo.get.mockResolvedValue({ contentType: 'image/png', data: image });

    const response = await logoRequest('GET');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(Buffer.from(await response.arrayBuffer()).equals(image)).toBe(true);
  });

  test('GET answers 404 without a logo, and DELETE answers 204', async () => {
    Logo.get.mockResolvedValue(null);

    expect((await logoRequest('GET')).status).toBe(404);
    expect((await logoRequest('DELETE')).status).toBe(204);
    expect(Logo.remove).toHaveBeenCalled();
  });

  test('PUT with a body that is not JSON answers 400', async () => {
    const response = await fetch(`${baseUrl}/api/settings/logo`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain', ...LOGGED_IN },
      body: 'hello',
    });

    expect(response.status).toBe(400);
    expect(Logo.set).not.toHaveBeenCalled();
  });
});
