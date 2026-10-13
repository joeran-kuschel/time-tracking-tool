const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

// OWASP's minimum for scrypt: 128 MiB of memory per hash. The parameters are stored with each hash,
// so they can be raised later without invalidating existing passwords.
const DEFAULT_PARAMS = { N: 2 ** 17, r: 8, p: 1 };
const KEY_LENGTH = 64;

// One hash at a time: each needs 128 MiB and the pod has 512Mi, while Node would run four in parallel
let queue = Promise.resolve();

function derive(password, salt, { N, r, p }) {
  // scrypt needs about 128 * N * r bytes plus a little; the limit follows the parameters, so they can be raised
  const maxmem = 130 * N * r + 1024 * 1024;
  const result = queue.then(() => scrypt(password, salt, KEY_LENGTH, { N, r, p, maxmem }));
  queue = result.catch(() => {});
  return result;
}

// "scrypt$N$r$p$salt$hash", salt and hash in hex
async function hashPassword(password, params = DEFAULT_PARAMS) {
  const salt = crypto.randomBytes(16);
  const hash = await derive(password, salt, params);
  return ['scrypt', params.N, params.r, params.p, salt.toString('hex'), hash.toString('hex')].join('$');
}

async function verifyPassword(password, stored) {
  const [scheme, N, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  let actual;
  try {
    actual = await derive(password, Buffer.from(salt, 'hex'), { N: +N, r: +r, p: +p });
  } catch {
    return false; // parameters scrypt refuses: a damaged hash
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

const MIN_LENGTH = 10;
const REQUIREMENTS = [
  [(password) => [...password].length >= MIN_LENGTH, `at least ${MIN_LENGTH} characters`],
  [(password) => /\p{Lu}/u.test(password), 'a capital letter'],
  [(password) => /\p{N}/u.test(password), 'a number'],
  [(password) => /[^\p{L}\p{N}\s]/u.test(password), 'a special character'],
];

// The requirements a new password doesn't meet, as texts; empty when it is fine. Checked when the password
// is set, never at login, so a password that was valid once can always be used.
function passwordProblems(password) {
  return REQUIREMENTS.filter(([met]) => !met(password)).map(([, text]) => text);
}

module.exports = { hashPassword, verifyPassword, passwordProblems, DEFAULT_PARAMS };
