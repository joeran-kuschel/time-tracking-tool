// SSL is controlled by DB_SSL ("true" to enable), independent of NODE_ENV.
// The in-cluster Postgres has no SSL; remote databases usually require it.
function getSslConfig(env = process.env) {
  const value = (env.DB_SSL || '').trim().toLowerCase();
  return value === 'true' ? { rejectUnauthorized: false } : false;
}

module.exports = { getSslConfig };
