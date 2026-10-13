const { SESSION_COOKIE, newToken, hashToken, readSessionToken } = require('../src/utils/sessionToken');

const request = (cookie) => ({ headers: cookie === undefined ? {} : { cookie } });

describe('newToken and hashToken', () => {
  test('makes a long random token that is safe in a cookie', () => {
    const token = newToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newToken()).not.toBe(token);
  });

  test('hashes to 64 hex characters, the same every time, and differently for another token', () => {
    expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
    expect(hashToken('abc')).not.toContain('abc');
  });
});

describe('readSessionToken', () => {
  test('reads the session cookie among others', () => {
    expect(readSessionToken(request(`theme=dark; ${SESSION_COOKIE}=tok_en-1; lang=de`))).toBe('tok_en-1');
  });

  test('keeps an = inside the value', () => {
    expect(readSessionToken(request(`${SESSION_COOKIE}=a=b=`))).toBe('a=b=');
  });

  test.each([undefined, '', 'theme=dark', `${SESSION_COOKIE}=`, `x${SESSION_COOKIE}=abc`, `${SESSION_COOKIE}x=abc`])(
    'finds no token in %p',
    (cookie) => {
      expect(readSessionToken(request(cookie))).toBeUndefined();
    },
  );

  test('takes the first of two session cookies', () => {
    expect(readSessionToken(request(`${SESSION_COOKIE}=first; ${SESSION_COOKIE}=second`))).toBe('first');
  });

  test('copes with extra spaces and empty parts', () => {
    expect(readSessionToken(request(`;; theme=dark ;   ${SESSION_COOKIE}=abc  ;`))).toBe('abc');
  });
});
