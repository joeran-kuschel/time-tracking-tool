// The connection string without its password, safe to write to logs.
function redactConnectionString(connectionString) {
  if (!connectionString) return '(not set)';
  // Never echo a value that isn't a URL with a host: it may still contain the password
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    return '(not a valid URL)';
  }
  if (!url.host) return '(not a valid URL)';
  if (url.password) url.password = '***';
  return url.toString();
}

module.exports = { redactConnectionString };
