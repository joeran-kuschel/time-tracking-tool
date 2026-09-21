require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const customerRoutes = require('./routes/customers');
const projectRoutes = require('./routes/projects');
const timeEntryRoutes = require('./routes/timeEntries');
const reportRoutes = require('./routes/reports');
const { redactConnectionString } = require('./config/redact');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/customers', customerRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Time tracking API running on port ${PORT}`);
  console.log(`Database: ${redactConnectionString(process.env.DATABASE_URL)}`);
});
