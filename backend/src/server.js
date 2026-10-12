// Times are stored as UTC in TIMESTAMP columns, which pg reads as local time: the process must run in UTC,
// also with `npm run dev` on a machine in another time zone. Set before anything creates a Date.
process.env.TZ = 'UTC';

require('dotenv').config({ quiet: true });
const { createApp, parseOrigins } = require('./app');
const { redactConnectionString } = require('./config/redact');

const PORT = process.env.PORT || 3000;
const corsOrigins = parseOrigins(process.env.CORS_ORIGIN);

createApp({ corsOrigins }).listen(PORT, () => {
  console.log(`Time tracking API running on port ${PORT}`);
  console.log(`Database: ${redactConnectionString(process.env.DATABASE_URL)}`);
  if (corsOrigins.length > 0) {
    console.log(`Allowed origins: ${corsOrigins.join(', ')}`);
  } else {
    console.warn('CORS_ORIGIN is not set: no browser app can use the API. Set it to the address of the frontend.');
  }
});
