const { patternProblem, hasYear, counterScope, formatInvoiceNumber } = require('../src/utils/invoiceNumber');

// The same table is in frontend/tests/invoiceNumber.test.js: the preview there must agree with the number made here
const FORMATS = [
  ['{YYYY}-{NNNN}', 1, '2026-0001'],
  ['{YYYY}-{NNNN}', 42, '2026-0042'],
  ['{YY}{MM}-{NNN}', 7, '2603-007'],
  ['RE/{YYYY}/{MM}/{NN}', 5, 'RE/2026/03/05'],
  ['{NNNN}', 12345, '12345'],
  ['Rechnung {N}', 9, 'Rechnung 9'],
  ['{NNNNNNNN}', 1, '00000001'],
];

describe('invoice number pattern', () => {
  test.each(FORMATS)('%s with %i makes %s (March 2026)', (pattern, number, expected) => {
    expect(formatInvoiceNumber(pattern, number, new Date('2026-03-04T10:00:00Z'))).toBe(expected);
  });

  test('uses the UTC date: a few minutes after midnight on 1 January is the new year', () => {
    expect(formatInvoiceNumber('{YYYY}-{MM}-{NN}', 1, new Date('2027-01-01T00:05:00Z'))).toBe('2027-01-01');
    expect(formatInvoiceNumber('{YYYY}-{MM}-{NN}', 1, new Date('2026-12-31T23:55:00Z'))).toBe('2026-12-01');
  });

  test.each([
    ['{YYYY}-{NNNN}'], ['{NNNN}'], ['RE-{NNNN}'], ['{YY}{MM}{N}'], ['a b.c_d/e-{NN}'], ['{NNNNNNNN}'], ['x'.repeat(28) + '{NNNN}'],
  ])('accepts %j', (pattern) => {
    expect(patternProblem(pattern)).toBeNull();
  });

  test.each([
    ['', 'text'], [' {NNNN}', 'text'], ['{NNNN} ', 'text'], [null, 'text'], [5, 'text'], [undefined, 'text'], ['x'.repeat(41), 'text'],
    ['{YYYY}', 'counter'], ['{NNNN}{NN}', 'counter'], ['RE', 'counter'], ['{YYYY}-{MM}', 'counter'],
    ['{NNNNNNNNN}', 'characters'], ['{}{NNNN}', 'characters'], ['{nnnn}', 'characters'], ['{DD}-{NNNN}', 'characters'],
    ['#{NNNN}', 'characters'], ['{NNNN}\n', 'text'], ['a\nb{NNNN}', 'characters'], ['Ä{NNNN}', 'characters'], ['{YYYY-{NNNN}', 'characters'],
  ])('refuses %j (%s)', (pattern, problem) => {
    expect(patternProblem(pattern)).toBe(problem);
  });

  test('a pattern of exactly 40 characters is valid, 41 is not', () => {
    expect(patternProblem('x'.repeat(37) + '{N}')).toBeNull();
    expect(patternProblem('x'.repeat(38) + '{N}')).toBe('text');
  });

  test.each([['{YYYY}-{NNNN}', true], ['{YY}-{NN}', true], ['{MM}-{NNNN}', false], ['RE-{NNNN}', false]])('%s has a year: %s', (pattern, year) => {
    expect(hasYear(pattern)).toBe(year);
  });

  test('the counter of a pattern with a year is that year, otherwise 0', () => {
    const date = new Date('2026-06-01T10:00:00Z');
    expect(counterScope('{YYYY}-{NNNN}', date)).toBe(2026);
    expect(counterScope('{YY}-{NNNN}', date)).toBe(2026);
    expect(counterScope('RE-{NNNN}', date)).toBe(0);
  });
});
