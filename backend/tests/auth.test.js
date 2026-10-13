jest.mock('../src/models/User');
jest.mock('../src/models/Session');
jest.mock('../src/models/Customer');
jest.mock('../src/utils/password', () => {
  const real = jest.requireActual('../src/utils/password');
  return { ...real, verifyPassword: jest.fn(real.verifyPassword) };
});

const User = require('../src/models/User');
const Session = require('../src/models/Session');
const { hashPassword, verifyPassword } = require('../src/utils/password');
const { hashToken } = require('../src/utils/sessionToken');
const { createApp } = require('../src/app');

const FRONTEND = 'http://localhost';
const PASSWORD = 'Correct-Horse-1';
let server;
let baseUrl;
let storedHash;

const send = (path, { method = 'GET', body, headers = {} } = {}) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body && JSON.stringify(body),
    redirect: 'manual',
  });

const login = (body = { email: 'me@example.com', password: PASSWORD }) => send('/api/auth/login', { method: 'POST', body });

beforeAll(async () => {
  storedHash = await hashPassword(PASSWORD, { N: 16, r: 8, p: 1 });
});

// A new app for each test, so the login limiter starts at zero
beforeEach((done) => {
  jest.clearAllMocks();
  User.findByEmail.mockImplementation(async (email) =>
    email === 'me@example.com' ? { id: 1, email, password_hash: storedHash } : undefined);
  Session.create.mockResolvedValue();
  Session.remove.mockResolvedValue();
  Session.removeExpired.mockResolvedValue();
  Session.findUser.mockImplementation(async (tokenHash) =>
    tokenHash === hashToken('valid-token') ? { id: 1, email: 'me@example.com' } : undefined);
  server = createApp({ corsOrigins: [FRONTEND] }).listen(0, () => {
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    done();
  });
});

afterEach((done) => {
  server.close(done);
});

describe('protected routes', () => {
  test.each([
    ['GET', '/api/customers'],
    ['POST', '/api/customers'],
    ['GET', '/api/customers/1'],
    ['DELETE', '/api/customers/1'],
    ['GET', '/api/projects/customer/1'],
    ['POST', '/api/projects'],
    ['GET', '/api/time-entries/active'],
    ['POST', '/api/time-entries'],
    ['PATCH', '/api/time-entries/1'],
    ['GET', '/api/time-entries/customer/1'],
    ['GET', '/api/reports/customer/1'],
    ['GET', '/api/reports/customer/1/pdf?month=1&year=2026'],
    ['PUT', '/api/reports/customer/1/status'],
    ['GET', '/api/dashboard'],
    ['GET', '/api/does-not-exist'],
    ['GET', '/api/auth/me'],
  ])('%s %s answers 401 without a session', async (method, path) => {
    const response = await send(path, { method, body: method === 'GET' ? undefined : {} });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Not logged in' });
  });

  test.each([
    ['an unknown token', 'session=other-token'],
    ['an empty token', 'session='],
    ['another cookie', 'theme=dark'],
  ])('answers 401 for %s', async (name, cookie) => {
    expect((await send('/api/customers', { headers: { Cookie: cookie } })).status).toBe(401);
  });

  test('looks the session up by the hash of the token, not the token itself', async () => {
    await send('/api/customers', { headers: { Cookie: 'session=valid-token' } });

    expect(Session.findUser).toHaveBeenCalledWith(hashToken('valid-token'));
    expect(Session.findUser).not.toHaveBeenCalledWith('valid-token');
  });

  test('lets a valid session through', async () => {
    const Customer = require('../src/models/Customer');
    Customer.getAll.mockResolvedValue([{ id: 1, name: 'Muster' }]);

    const response = await send('/api/customers', { headers: { Cookie: 'session=valid-token' } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: 1, name: 'Muster' }]);
  });

  test('answers 500 when the session cannot be looked up', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    Session.findUser.mockRejectedValue(new Error('database down'));

    const response = await send('/api/customers', { headers: { Cookie: 'session=valid-token' } });

    expect(response.status).toBe(500);
    console.error.mockRestore();
  });

  test('keeps /health open for the Kubernetes probes', async () => {
    const response = await send('/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'OK' });
  });

  test('sends nosniff with every answer', async () => {
    expect((await send('/health')).headers.get('x-content-type-options')).toBe('nosniff');
    expect((await send('/api/customers')).headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('POST /api/auth/login', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = originalEnv; });

  test('starts a session with a cookie the page cannot read', async () => {
    const response = await login();
    const cookie = response.headers.get('set-cookie');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: 'me@example.com' });
    expect(cookie).toMatch(/^session=[A-Za-z0-9_-]{43};/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
  });

  test('stores only the hash of the token', async () => {
    const response = await login();
    const token = response.headers.get('set-cookie').match(/^session=([^;]+)/)[1];

    expect(Session.create).toHaveBeenCalledWith(1, hashToken(token));
    expect(Session.create).not.toHaveBeenCalledWith(expect.anything(), token);
  });

  test('the cookie of the login works for the next request', async () => {
    const response = await login();
    const token = response.headers.get('set-cookie').match(/^session=([^;]+)/)[1];
    Session.findUser.mockImplementation(async (tokenHash) =>
      tokenHash === hashToken(token) ? { id: 1, email: 'me@example.com' } : undefined);

    const me = await send('/api/auth/me', { headers: { Cookie: `session=${token}` } });

    expect(await me.json()).toEqual({ email: 'me@example.com' });
  });

  test('is Secure in production only', async () => {
    process.env.NODE_ENV = 'production';
    expect((await login()).headers.get('set-cookie')).toContain('Secure');

    process.env.NODE_ENV = 'development';
    expect((await login()).headers.get('set-cookie')).not.toContain('Secure');
  });

  test('finds the user in any case', async () => {
    await login({ email: 'Me@Example.com', password: PASSWORD });

    expect(User.findByEmail).toHaveBeenCalledWith('Me@Example.com');
  });

  test('deletes expired sessions', async () => {
    await login();

    expect(Session.removeExpired).toHaveBeenCalled();
  });

  test('is not cached', async () => {
    expect((await login()).headers.get('cache-control')).toBe('no-store');
  });

  test('answers a wrong password and an unknown email with the same 401 and no cookie', async () => {
    const wrongPassword = await login({ email: 'me@example.com', password: 'Wrong-Horse-1' });
    const unknownEmail = await login({ email: 'nobody@example.com', password: PASSWORD });

    for (const response of [wrongPassword, unknownEmail]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Wrong email or password' });
      expect(response.headers.get('set-cookie')).toBeNull();
    }
    expect(Session.create).not.toHaveBeenCalled();
  });

  test('checks a password for an unknown email too, so the answer takes as long', async () => {
    await login({ email: 'nobody@example.com', password: PASSWORD });

    expect(verifyPassword).toHaveBeenCalledTimes(1);
    expect(verifyPassword.mock.calls[0][1]).not.toBe(storedHash);
    expect(verifyPassword.mock.calls[0][1]).toMatch(/^scrypt\$/);
  });

  test.each([
    ['no body', undefined],
    ['no password', { email: 'me@example.com' }],
    ['no email', { password: PASSWORD }],
    ['an empty password', { email: 'me@example.com', password: '' }],
    ['a number as password', { email: 'me@example.com', password: 12345 }],
    ['an object as email', { email: { $ne: '' }, password: PASSWORD }],
  ])('answers 400 for %s', async (name, body) => {
    const response = await send('/api/auth/login', { method: 'POST', body: body ?? {} });

    expect(response.status).toBe(400);
    expect(User.findByEmail).not.toHaveBeenCalled();
  });

  test('answers 500 when the database fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    User.findByEmail.mockRejectedValue(new Error('database down'));

    expect((await login()).status).toBe(500);
    console.error.mockRestore();
  });

  test('refuses a login from a page on another origin', async () => {
    const response = await send('/api/auth/login', {
      method: 'POST',
      body: { email: 'me@example.com', password: PASSWORD },
      headers: { Origin: 'https://evil.example' },
    });

    expect(response.status).toBe(403);
    expect(Session.create).not.toHaveBeenCalled();
  });

  test('stops after 10 failed logins, even with the right password', async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await login({ email: 'me@example.com', password: 'Wrong-Horse-1' })).status).toBe(401);
    }

    const blocked = await login();
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'Too many failed logins. Try again in a few minutes.' });
    expect(blocked.headers.get('set-cookie')).toBeNull();
  });

  test('does not count successful logins', async () => {
    for (let i = 0; i < 12; i += 1) {
      expect((await login()).status).toBe(200);
    }
  });
});

describe('POST /api/auth/logout', () => {
  test('ends the session and removes the cookie', async () => {
    const response = await send('/api/auth/logout', { method: 'POST', headers: { Cookie: 'session=valid-token' } });

    expect(response.status).toBe(204);
    expect(Session.remove).toHaveBeenCalledWith(hashToken('valid-token'));
    expect(response.headers.get('set-cookie')).toMatch(/^session=;.*(Expires=Thu, 01 Jan 1970|Max-Age=0)/);
  });
});

describe('GET /api/auth/me', () => {
  test('answers who is logged in, without caching', async () => {
    const response = await send('/api/auth/me', { headers: { Cookie: 'session=valid-token' } });

    expect(await response.json()).toEqual({ email: 'me@example.com' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

describe('cookie handling', () => {
  test('uses the first session cookie when there are two', async () => {
    const response = await send('/api/auth/me', { headers: { Cookie: 'session=valid-token; session=other-token' } });

    expect(response.status).toBe(200);
  });

  test('ignores a session cookie that only looks similar', async () => {
    const response = await send('/api/auth/me', { headers: { Cookie: 'xsession=valid-token; session_id=valid-token' } });

    expect(response.status).toBe(401);
  });

  test('does not cache a refusal', async () => {
    expect((await send('/api/auth/me')).headers.get('cache-control')).toBe('no-store');
  });
});

describe('Origin check', () => {
  const withOrigin = (origin) => (origin === undefined ? {} : { Origin: origin });

  test.each(['POST', 'PUT', 'PATCH', 'DELETE'])('refuses %s from a page on another origin, before the login check', async (method) => {
    const response = await send('/api/customers/1', { method, body: {}, headers: withOrigin('https://evil.example') });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Origin not allowed' });
  });

  test('lets a GET from another origin reach the login check (CORS keeps the answer from the page)', async () => {
    const response = await send('/api/customers', { headers: withOrigin('https://evil.example') });

    expect(response.status).toBe(401);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  test.each([
    ['the frontend', FRONTEND],
    ['no Origin header (not a browser page)', undefined],
  ])('lets a change through from %s', async (name, origin) => {
    const response = await send('/api/customers', { method: 'POST', body: {}, headers: withOrigin(origin) });

    expect(response.status).toBe(401);
  });

  test.each([
    ['the string null (sandboxed pages)', 'null'],
    ['a trailing slash', `${FRONTEND}/`],
    ['another port', `${FRONTEND}:8080`],
    ['another scheme', 'https://localhost'],
    ['another case', 'HTTP://LOCALHOST'],
  ])('refuses a change from %s', async (name, origin) => {
    const response = await send('/api/customers', { method: 'POST', body: {}, headers: withOrigin(origin) });

    expect(response.status).toBe(403);
  });

  test('allows the CORS answer with the cookie for the frontend only', async () => {
    const response = await send('/api/auth/me', { headers: withOrigin(FRONTEND) });

    expect(response.headers.get('access-control-allow-origin')).toBe(FRONTEND);
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
  });

  test('refuses every change from a browser page when CORS_ORIGIN is empty', async () => {
    await new Promise((resolve) => server.close(resolve));
    server = createApp({ corsOrigins: [] }).listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const fromPage = await send('/api/auth/login', { method: 'POST', body: {}, headers: withOrigin(FRONTEND) });
    const fromTool = await send('/api/auth/login', { method: 'POST', body: {} });

    expect(fromPage.status).toBe(403);
    expect(fromTool.status).toBe(400);
  });
});

describe('login with odd input', () => {
  test('answers 401, not 500, for a very long password', async () => {
    const response = await login({ email: 'me@example.com', password: `${'A1!'.repeat(30000)}` });

    expect(response.status).toBe(401);
  });

  test('answers 401 for a very long email', async () => {
    const response = await login({ email: `${'a'.repeat(5000)}@example.com`, password: PASSWORD });

    expect(response.status).toBe(401);
  });

  test('answers 413 for a body over the JSON limit, without a session and without logging an error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const response = await login({ email: 'me@example.com', password: 'x'.repeat(200 * 1024) });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'Request body too large' });
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
    console.error.mockRestore();
  });

  test('answers 400 for malformed JSON without logging an error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid request' });
    expect(console.error).not.toHaveBeenCalled();
    console.error.mockRestore();
  });

  test.each([
    ['an array body', []],
    ['null values', { email: null, password: null }],
    ['an empty email', { email: '', password: PASSWORD }],
    ['a boolean password', { email: 'me@example.com', password: true }],
  ])('answers 400 for %s', async (name, body) => {
    expect((await login(body)).status).toBe(400);
    expect(User.findByEmail).not.toHaveBeenCalled();
  });

  test('answers 500 and sets no cookie when the session cannot be stored', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    Session.create.mockRejectedValue(new Error('database down'));

    const response = await login();

    expect(response.status).toBe(500);
    expect(response.headers.get('set-cookie')).toBeNull();
    console.error.mockRestore();
  });
});

describe('login limit', () => {
  const wrong = () => login({ email: 'me@example.com', password: 'Wrong-Horse-1' });

  test('counts a request with a missing password as a failure', async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await login({ email: 'me@example.com' })).status).toBe(400);
    }

    expect((await login()).status).toBe(429);
  });

  test('counts failures of unknown emails with the failures of the known one', async () => {
    // An unknown email costs a full-strength scrypt run (the dummy hash), so only a few of them
    for (let i = 0; i < 2; i += 1) await login({ email: 'nobody@example.com', password: PASSWORD });
    for (let i = 0; i < 8; i += 1) await wrong();

    expect((await login()).status).toBe(429);
  });

  test('does not reset the count by a successful login in between', async () => {
    for (let i = 0; i < 9; i += 1) await wrong();
    expect((await login()).status).toBe(200);
    await wrong();

    expect((await login()).status).toBe(429);
  });

  test('does not count refused origins or other routes', async () => {
    for (let i = 0; i < 12; i += 1) {
      await send('/api/auth/login', { method: 'POST', body: {}, headers: { Origin: 'https://evil.example' } });
      await send('/api/customers');
    }

    expect((await login()).status).toBe(200);
  });

  test('holds back parallel guesses: only 10 get past the limit', async () => {
    const answers = await Promise.all(Array.from({ length: 30 }, wrong));

    expect(answers.filter((r) => r.status === 401)).toHaveLength(10);
    expect(answers.filter((r) => r.status === 429)).toHaveLength(20);
  });

  test('does not limit the session routes', async () => {
    for (let i = 0; i < 12; i += 1) await wrong();

    expect((await send('/api/auth/me', { headers: { Cookie: 'session=valid-token' } })).status).toBe(200);
  });
});

describe('logout with a session that no longer exists', () => {
  test('answers 204 and removes the cookie when the session has ended or never existed', async () => {
    const stale = await send('/api/auth/logout', { method: 'POST', headers: { Cookie: 'session=expired-token' } });
    const none = await send('/api/auth/logout', { method: 'POST' });

    for (const response of [stale, none]) {
      expect(response.status).toBe(204);
      expect(response.headers.get('set-cookie')).toMatch(/^session=;/);
    }
    expect(Session.remove).toHaveBeenCalledTimes(1);
  });

  test('does not touch other sessions', async () => {
    await send('/api/auth/logout', { method: 'POST', headers: { Cookie: 'session=expired-token' } });

    expect(Session.remove).not.toHaveBeenCalledWith(hashToken('valid-token'));
  });
});
