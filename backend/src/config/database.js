const { Pool } = require('pg');
require('dotenv').config();
const { getSslConfig } = require('./ssl');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: getSslConfig()
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;
