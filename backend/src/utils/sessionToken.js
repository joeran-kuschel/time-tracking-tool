const crypto = require('crypto');

const SESSION_COOKIE = 'session';

// A random token for the cookie. Only its hash is stored in the database.
const newToken = () => crypto.randomBytes(32).toString('base64url');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// The session token from the Cookie header, or undefined
function readSessionToken(req) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === SESSION_COOKIE) return value.join('=') || undefined;
  }
  return undefined;
}

module.exports = { SESSION_COOKIE, newToken, hashToken, readSessionToken };
