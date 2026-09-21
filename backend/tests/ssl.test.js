const { getSslConfig } = require('../src/config/ssl');

describe('getSslConfig', () => {
  test('disables SSL when DB_SSL is not set', () => {
    expect(getSslConfig({})).toBe(false);
  });

  test('disables SSL when DB_SSL is "false"', () => {
    expect(getSslConfig({ DB_SSL: 'false' })).toBe(false);
  });

  test('enables SSL when DB_SSL is "true"', () => {
    expect(getSslConfig({ DB_SSL: 'true' })).toEqual({ rejectUnauthorized: false });
  });

  test('ignores case and surrounding whitespace', () => {
    expect(getSslConfig({ DB_SSL: ' TRUE ' })).toEqual({ rejectUnauthorized: false });
  });

  test('does not depend on NODE_ENV', () => {
    expect(getSslConfig({ NODE_ENV: 'production' })).toBe(false);
    expect(getSslConfig({ NODE_ENV: 'development', DB_SSL: 'true' }))
      .toEqual({ rejectUnauthorized: false });
  });

  test('treats unknown values as disabled', () => {
    expect(getSslConfig({ DB_SSL: 'yes' })).toBe(false);
  });
});
