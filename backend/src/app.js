const express = require('express');
const cors = require('cors');

const customerRoutes = require('./routes/customers');
const projectRoutes = require('./routes/projects');
const timeEntryRoutes = require('./routes/timeEntries');
const reportRoutes = require('./routes/reports');
const dashboardRoutes = require('./routes/dashboard');

// The origins from CORS_ORIGIN, e.g. "http://localhost,http://localhost:5173"
function parseOrigins(value) {
  return (value || '').split(',').map((origin) => origin.trim()).filter(Boolean);
}

// The API. Only browsers on the given origins may call it; Content-Disposition is readable for them,
// so a downloaded PDF keeps the backend's file name. Bodies are JSON only: plain HTML forms from other
// sites send form data without asking the browser's CORS check first.
function createApp({ corsOrigins }) {
  const app = express();

  app.use(cors({ origin: corsOrigins, exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json());

  app.use('/api/customers', customerRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/time-entries', timeEntryRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
  });

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp, parseOrigins };
