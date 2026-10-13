const User = require('../models/User');
const Session = require('../models/Session');
const { hashPassword, verifyPassword } = require('../utils/password');
const { SESSION_COOKIE, newToken, hashToken, readSessionToken } = require('../utils/sessionToken');

// Checked for unknown emails too, so a wrong email takes as long as a wrong password
const dummyHash = hashPassword('not a password');

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findByEmail(email);
    const passwordFits = await verifyPassword(password, user ? user.password_hash : await dummyHash);
    if (!user || !passwordFits) {
      return res.status(401).json({ error: 'Wrong email or password' });
    }

    const token = newToken();
    await Session.removeExpired();
    await Session.create(user.id, hashToken(token));
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: Session.MAX_AGE });
    res.json({ email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
};

// Always succeeds for the client: no session, or one that has ended, is logged out too
exports.logout = async (req, res) => {
  try {
    const token = readSessionToken(req);
    if (token) await Session.remove(hashToken(token));
    res.clearCookie(SESSION_COOKIE, cookieOptions());
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Logout failed' });
  }
};

// Behind requireAuth: answers who is logged in
exports.me = (req, res) => {
  res.json({ email: req.user.email });
};
