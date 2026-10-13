const { createTestPool } = require('./helpers/testDb');

let mockPool;
jest.mock('../src/config/database', () => ({
  query: (...args) => mockPool.query(...args),
}));

const User = require('../src/models/User');
const Session = require('../src/models/Session');

const NOW = new Date('2026-10-15T10:00:00Z');
const later = (ms) => new Date(NOW.getTime() + ms);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function sessionRow(tokenHash) {
  const result = await mockPool.query('SELECT * FROM sessions WHERE token_hash = $1', [tokenHash]);
  return result.rows[0];
}

beforeEach(() => {
  mockPool = createTestPool();
});

describe('User', () => {
  test('saves a user and finds them by email in any case', async () => {
    const saved = await User.save('Me@Example.com', 'hash-1');
    const found = await User.findByEmail('ME@example.COM');

    expect(saved).toEqual({ id: expect.any(Number), email: 'me@example.com' });
    expect(found).toEqual({ id: saved.id, email: 'me@example.com', password_hash: 'hash-1' });
  });

  test('finds nobody for an unknown email', async () => {
    expect(await User.findByEmail('nobody@example.com')).toBeUndefined();
  });

  test('replaces the password of an existing user instead of adding a second one', async () => {
    const first = await User.save('me@example.com', 'hash-1');
    const second = await User.save('ME@example.com', 'hash-2');

    expect(second.id).toBe(first.id);
    expect((await User.findByEmail('me@example.com')).password_hash).toBe('hash-2');
    expect((await mockPool.query('SELECT COUNT(*) AS n FROM users')).rows[0].n).toBe(1);
  });
});

describe('Session', () => {
  let user;

  beforeEach(async () => {
    user = await User.save('me@example.com', 'hash-1');
  });

  test('finds the user of a valid session', async () => {
    await Session.create(user.id, 'token-hash', NOW);

    expect(await Session.findUser('token-hash', later(HOUR))).toEqual({ id: user.id, email: 'me@example.com' });
  });

  test('finds nobody for an unknown token', async () => {
    await Session.create(user.id, 'token-hash', NOW);

    expect(await Session.findUser('other-hash', NOW)).toBeUndefined();
  });

  test('ends after 14 days without a request', async () => {
    await Session.create(user.id, 'before', NOW);
    await Session.create(user.id, 'after', NOW);

    expect(await Session.findUser('before', later(14 * DAY - HOUR))).toBeDefined();
    expect(await Session.findUser('after', later(14 * DAY + HOUR))).toBeUndefined();
  });

  test('ends 14 days after the last request that moved the expiry', async () => {
    await Session.create(user.id, 'before', NOW);
    await Session.create(user.id, 'after', NOW);
    await Session.findUser('before', later(10 * DAY));
    await Session.findUser('after', later(10 * DAY));

    expect(await Session.findUser('before', later(23 * DAY))).toBeDefined();
    expect(await Session.findUser('after', later(25 * DAY))).toBeUndefined();
  });

  test('ends 30 days after the login however often it is used', async () => {
    await Session.create(user.id, 'token-hash', NOW);
    for (let day = 10; day <= 29; day += 10) {
      expect(await Session.findUser('token-hash', later(day * DAY))).toBeDefined();
    }

    expect(await Session.findUser('token-hash', later(30 * DAY + HOUR))).toBeUndefined();
  });

  test('moves the expiry at most once an hour', async () => {
    await Session.create(user.id, 'token-hash', NOW);
    const created = new Date((await sessionRow('token-hash')).expires_at).getTime();

    await Session.findUser('token-hash', later(30 * 60 * 1000));
    expect(new Date((await sessionRow('token-hash')).expires_at).getTime()).toBe(created);

    await Session.findUser('token-hash', later(2 * HOUR));
    expect(new Date((await sessionRow('token-hash')).expires_at).getTime()).toBe(later(2 * HOUR + 14 * DAY).getTime());
  });

  test('ends exactly when the idle expiry is reached', async () => {
    await Session.create(user.id, 'token-hash', NOW);

    expect(await Session.findUser('token-hash', later(14 * DAY - 1))).toBeDefined();
  });

  test('is already ended at the moment of the idle expiry', async () => {
    await Session.create(user.id, 'token-hash', NOW);

    expect(await Session.findUser('token-hash', later(14 * DAY))).toBeUndefined();
  });

  test('does not bring an ended session back by asking for it', async () => {
    await Session.create(user.id, 'token-hash', NOW);
    const expires = (await sessionRow('token-hash')).expires_at;

    expect(await Session.findUser('token-hash', later(15 * DAY))).toBeUndefined();
    expect((await sessionRow('token-hash')).expires_at).toEqual(expires);
    expect(await Session.findUser('token-hash', later(HOUR))).toBeDefined();
  });

  test('ends at the absolute limit even right after a request moved the expiry', async () => {
    await Session.create(user.id, 'token-hash', NOW);
    await Session.findUser('token-hash', later(29 * DAY));

    expect(await Session.findUser('token-hash', later(30 * DAY))).toBeUndefined();
  });

  test('refuses a second session with the same token hash', async () => {
    await Session.create(user.id, 'token-hash', NOW);

    await expect(Session.create(user.id, 'token-hash', NOW)).rejects.toThrow();
  });

  test('removing an unknown session is not an error', async () => {
    await expect(Session.remove('nothing')).resolves.toBeUndefined();
  });

  test('removeExpired keeps a session that is used every day for 29 days', async () => {
    await Session.create(user.id, 'daily', NOW);
    for (let day = 1; day <= 29; day += 1) await Session.findUser('daily', later(day * DAY));

    await Session.removeExpired(later(29 * DAY + HOUR));

    expect(await sessionRow('daily')).toBeDefined();
  });

  test('remove ends one session and keeps the others', async () => {
    await Session.create(user.id, 'one', NOW);
    await Session.create(user.id, 'two', NOW);

    await Session.remove('one');

    expect(await Session.findUser('one', NOW)).toBeUndefined();
    expect(await Session.findUser('two', NOW)).toBeDefined();
  });

  test('removeAllOfUser ends every session of the user', async () => {
    const other = await User.save('other@example.com', 'hash-2');
    await Session.create(user.id, 'one', NOW);
    await Session.create(user.id, 'two', NOW);
    await Session.create(other.id, 'three', NOW);

    await Session.removeAllOfUser(user.id);

    expect(await Session.findUser('one', NOW)).toBeUndefined();
    expect(await Session.findUser('two', NOW)).toBeUndefined();
    expect(await Session.findUser('three', NOW)).toBeDefined();
  });

  test('removeExpired deletes idle and too old sessions only', async () => {
    await Session.create(user.id, 'idle', NOW);
    await Session.create(user.id, 'old', later(-20 * DAY));
    await Session.findUser('old', later(-10 * DAY));
    await Session.create(user.id, 'fresh', later(25 * DAY));

    await Session.removeExpired(later(31 * DAY));

    expect(await sessionRow('idle')).toBeUndefined();
    expect(await sessionRow('old')).toBeUndefined();
    expect(await sessionRow('fresh')).toBeDefined();
  });

  test('is deleted together with its user', async () => {
    await Session.create(user.id, 'one', NOW);

    await mockPool.query('DELETE FROM users WHERE id = $1', [user.id]);

    expect(await sessionRow('one')).toBeUndefined();
  });
});
