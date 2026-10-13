const { rateLimit } = require('express-rate-limit');

// At most 10 failed logins per 15 minutes, counted for the whole tool, not per address: with one user
// the address says little, and behind the ingress every client may look the same. Successful logins
// don't count. One limiter per app, so tests and apps don't share their counts.
function createLoginLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    keyGenerator: () => 'login',
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many failed logins. Try again in a few minutes.' },
  });
}

module.exports = createLoginLimiter;
