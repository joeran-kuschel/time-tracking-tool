const express = require('express');
const cors = require('cors');

const customerRoutes = require('./routes/customers');
const projectRoutes = require('./routes/projects');
const timeEntryRoutes = require('./routes/timeEntries');
const reportRoutes = require('./routes/reports');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');
const requireAuth = require('./middleware/requireAuth');
const allowedOrigin = require('./middleware/allowedOrigin');
const createLoginLimiter = require('./middleware/loginLimiter');

// The origins from CORS_ORIGIN, e.g. "http://localhost,http://localhost:5173"
function parseOrigins(value) {
  return (value || '').split(',').map((origin) => origin.trim()).filter(Boolean);
}

// The API. Only browsers on the given origins may call it, with their login cookie; Content-Disposition is
// readable for them, so a downloaded PDF keeps the backend's file name. Bodies are JSON only: plain HTML forms
// from other sites send form data without asking the browser's CORS check first. Everything but the login and
// /health needs a session.
function createApp({ corsOrigins }) {
  const app = express();

  app.use(cors({ origin: corsOrigins, credentials: true, exposedHeaders: ['Content-Disposition'] }));
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use(allowedOrigin(corsOrigins));
  app.use(express.json());
  // Express 5 leaves req.body undefined without a parsed body; the controllers expect an object
  app.use((req, res, next) => {
    req.body ??= {};
    next();
  });

  app.use('/api/auth/login', createLoginLimiter());
  app.use('/api/auth', authRoutes);
  app.use('/api', requireAuth);

  app.use('/api/customers', customerRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/time-entries', timeEntryRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
  });

  // Errors of the body parser (malformed JSON, a body that is too large) are the client's: keep their 4xx status
  app.use((err, req, res, next) => {
    if (err.status >= 400 && err.status < 500) {
      return res.status(err.status).json({ error: err.status === 413 ? 'Request body too large' : 'Invalid request' });
    }
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp, parseOrigins };
