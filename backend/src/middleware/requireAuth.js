const Session = require('../models/Session');
const { hashToken, readSessionToken } = require('../utils/sessionToken');

// Lets only requests with a valid session through; req.user is the logged-in user
async function requireAuth(req, res, next) {
  try {
    const token = readSessionToken(req);
    const user = token && (await Session.findUser(hashToken(token)));
    if (!user) {
      return res.status(401).json({ error: 'Not logged in' });
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAuth;
