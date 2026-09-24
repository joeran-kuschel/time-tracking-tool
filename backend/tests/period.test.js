const { parseMonth, previousMonth } = require('../src/utils/period');

describe('parseMonth', () => {
  test('parses month and year from query strings', () => {
    expect(parseMonth('9', '2026')).toEqual({ month: 9, year: 2026 });
  });

  test.each([
    [undefined, '2026'], ['0', '2026'], ['13', '2026'], ['9', undefined], ['9.5', '2026'], ['sep', '2026'],
  ])('rejects month %p and year %p', (month, year) => {
    expect(parseMonth(month, year)).toBeNull();
  });
});

describe('previousMonth', () => {
  test('goes back one month, across the turn of the year', () => {
    expect(previousMonth({ month: 9, year: 2026 })).toEqual({ month: 8, year: 2026 });
    expect(previousMonth({ month: 1, year: 2026 })).toEqual({ month: 12, year: 2025 });
  });
});
