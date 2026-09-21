const fs = require('fs');
const path = require('path');
const { redactConnectionString } = require('../src/config/redact');

describe('redactConnectionString', () => {
  test('replaces the password and keeps user, host, port and database', () => {
    expect(redactConnectionString('postgresql://timetracking:password@postgres:5432/time_tracking'))
      .toBe('postgresql://timetracking:***@postgres:5432/time_tracking');
  });

  test('also hides passwords with special characters', () => {
    const redacted = redactConnectionString('postgresql://user:p%40ss%3Aw0rd!@db.example.com:5432/app?sslmode=require');
    expect(redacted).toBe('postgresql://user:***@db.example.com:5432/app?sslmode=require');
    expect(redacted).not.toMatch(/p%40ss|w0rd/);
  });

  test('leaves connection strings without a password unchanged', () => {
    expect(redactConnectionString('postgresql://postgres:5432/time_tracking')).toBe('postgresql://postgres:5432/time_tracking');
  });

  test('never echoes values it cannot parse', () => {
    expect(redactConnectionString('user:secret host=db')).toBe('(not a valid URL)');
    expect(redactConnectionString('user:secret@db:5432/app')).toBe('(not a valid URL)');
    expect(redactConnectionString('host=db user=app password=secret')).toBe('(not a valid URL)');
  });

  test('says when nothing is set', () => {
    expect(redactConnectionString(undefined)).toBe('(not set)');
    expect(redactConnectionString('')).toBe('(not set)');
  });
});

test('server.js only logs the redacted connection string', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'server.js'), 'utf8');
  const logLines = source.split('\n').filter((line) => /console\.\w+\(/.test(line) && line.includes('DATABASE_URL'));
  expect(logLines.length).toBeGreaterThan(0);
  logLines.forEach((line) => expect(line).toContain('redactConnectionString(process.env.DATABASE_URL)'));
});
