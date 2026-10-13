const { hashPassword, verifyPassword, passwordProblems } = require('../src/utils/password');

// Cheap parameters, so the tests don't each need 128 MiB; verifyPassword reads them from the hash
const CHEAP = { N: 16, r: 8, p: 1 };

describe('hashPassword and verifyPassword', () => {
  test('accepts the password and rejects another one', async () => {
    const hash = await hashPassword('Correct-Horse-1', CHEAP);

    expect(await verifyPassword('Correct-Horse-1', hash)).toBe(true);
    expect(await verifyPassword('Correct-Horse-2', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  test('stores the scheme and parameters with the hash, and never the password', async () => {
    const hash = await hashPassword('Correct-Horse-1', CHEAP);

    expect(hash).toMatch(/^scrypt\$16\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(hash).not.toContain('Correct-Horse-1');
  });

  test('uses a new salt for every hash', async () => {
    expect(await hashPassword('Correct-Horse-1', CHEAP)).not.toBe(await hashPassword('Correct-Horse-1', CHEAP));
  });

  test('uses the strong default parameters', async () => {
    expect((await hashPassword('Correct-Horse-1')).startsWith('scrypt$131072$8$1$')).toBe(true);
  });

  test.each(['', 'plain', 'bcrypt$16$8$1$aa$bb', 'scrypt$16$8$1$aa'])('rejects the unknown hash format %p', async (stored) => {
    expect(await verifyPassword('Correct-Horse-1', stored)).toBe(false);
  });

  test.each(['scrypt$16$8$1$aabb$aabb', 'scrypt$0$8$1$aabb$aabb', 'scrypt$16$8$1$zz$aabb'])(
    'rejects the damaged hash %p instead of throwing',
    async (stored) => {
      expect(await verifyPassword('Correct-Horse-1', stored)).toBe(false);
    },
  );

  test('rejects a hash cut short, even when the start matches', async () => {
    const hash = await hashPassword('Correct-Horse-1', CHEAP);

    expect(await verifyPassword('Correct-Horse-1', hash.slice(0, -2))).toBe(false);
  });

  test('handles characters outside ASCII', async () => {
    const hash = await hashPassword('Größe-ÄÖÜ-1!', CHEAP);

    expect(await verifyPassword('Größe-ÄÖÜ-1!', hash)).toBe(true);
    expect(await verifyPassword('Grosse-AOU-1!', hash)).toBe(false);
  });
});

describe('passwordProblems', () => {
  test('is empty for a password with 10 characters, a capital letter, a number and a special character', () => {
    expect(passwordProblems('Abcdefgh1!')).toEqual([]);
    expect(passwordProblems('a very Long passphrase, with 2 numbers 9')).toEqual([]);
  });

  test.each([
    ['Abcdefg1!', 'at least 10 characters'],
    ['abcdefgh1!', 'a capital letter'],
    ['Abcdefghi!', 'a number'],
    ['Abcdefgh12', 'a special character'],
  ])('names what %p is missing', (password, missing) => {
    expect(passwordProblems(password)).toEqual([missing]);
  });

  test('lists everything that is missing', () => {
    expect(passwordProblems('abc')).toEqual([
      'at least 10 characters',
      'a capital letter',
      'a number',
      'a special character',
    ]);
  });

  test('counts a space as neither a letter nor a special character', () => {
    expect(passwordProblems('Abcdefg 12')).toEqual(['a special character']);
  });

  test('counts letters with accents and other alphabets', () => {
    expect(passwordProblems('Ärgerlich1!')).toEqual([]);
    expect(passwordProblems('ärgerlich1!')).toEqual(['a capital letter']);
  });

  test('counts characters, not bytes, for the length', () => {
    expect(passwordProblems('Ää1!ää1!ä')).toEqual(['at least 10 characters']);
    expect(passwordProblems('Ää1!ää1!ää')).toEqual([]);
  });
});

describe('hashing runs one at a time', () => {
  test('several hashes at once give valid, different hashes', async () => {
    const hashes = await Promise.all([1, 2, 3, 4, 5].map((n) => hashPassword(`Correct-Horse-${n}`, CHEAP)));

    expect(new Set(hashes).size).toBe(5);
    for (const [index, hash] of hashes.entries()) {
      expect(await verifyPassword(`Correct-Horse-${index + 1}`, hash)).toBe(true);
    }
  });

  test('a failing hash does not stop the ones after it', async () => {
    await expect(hashPassword('x', { N: 3, r: 8, p: 1 })).rejects.toThrow();

    expect(await hashPassword('Correct-Horse-1', CHEAP)).toMatch(/^scrypt\$/);
  });

  test('allows raising the cost later: N=2^18 still fits the memory limit', async () => {
    const hash = await hashPassword('Correct-Horse-1', { N: 2 ** 18, r: 8, p: 1 });

    expect(await verifyPassword('Correct-Horse-1', hash)).toBe(true);
  });
});
