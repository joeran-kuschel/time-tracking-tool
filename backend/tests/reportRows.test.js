const { reportRows, calculateHours, formatHoursNumber } = require('../src/utils/reportRows');
const { activateLocale } = require('../src/i18n');

const entry = (overrides) => ({
  start_time: '2026-09-21T08:00:00Z',
  end_time: '2026-09-21T09:30:00Z',
  project_name: 'Website',
  description: 'Konzept',
  ...overrides,
});
const options = { customerName: 'Muster GmbH', locale: 'en', timeZone: 'UTC' };

describe('reportRows', () => {
  test('has the columns date, start, end, customer, project, description and hours', () => {
    expect(reportRows([], options).headers).toEqual(['Date', 'Start', 'End', 'Customer', 'Project', 'Description', 'Hours']);
    expect(reportRows([], { ...options, locale: 'de' }).headers).toEqual(['Datum', 'Beginn', 'Ende', 'Kunde', 'Projekt', 'Beschreibung', 'Stunden']);
  });

  test('turns an entry into typed cells', () => {
    const { rows } = reportRows([entry()], options);

    expect(rows).toEqual([[
      { text: '2026-09-21' }, { text: '08:00' }, { text: '09:30' }, { text: 'Muster GmbH' },
      { text: 'Website' }, { text: 'Konzept' }, { number: '1.50' },
    ]]);
  });

  test('keeps the order of the entries', () => {
    const { rows } = reportRows([entry({ project_name: 'B' }), entry({ project_name: 'A' })], options);

    expect(rows.map((row) => row[4].text)).toEqual(['B', 'A']);
  });

  test('writes the hours with the decimal separator of the language and no unit', () => {
    expect(reportRows([entry()], { ...options, locale: 'de' }).rows[0][6]).toEqual({ number: '1,50' });
    expect(reportRows([entry()], { ...options, locale: 'en' }).rows[0][6]).toEqual({ number: '1.50' });
  });

  test('falls back to German for an unknown or missing language', () => {
    expect(reportRows([entry()], { ...options, locale: undefined }).rows[0][6]).toEqual({ number: '1,50' });
  });

  test('rounds the hours to two decimals', () => {
    const { rows } = reportRows([entry({ end_time: '2026-09-21T08:20:00Z' })], options);

    expect(rows[0][6]).toEqual({ number: '0.33' });
  });

  test('shows a running entry with an empty end and 0 hours', () => {
    const { rows } = reportRows([entry({ end_time: null })], options);

    expect(rows[0][2]).toEqual({ text: '' });
    expect(rows[0][6]).toEqual({ number: '0.00' });
  });

  test('writes an empty description and a missing one as empty text', () => {
    const { rows } = reportRows([entry({ description: null }), entry({ description: '' })], options);

    expect(rows.map((row) => row[5])).toEqual([{ text: '' }, { text: '' }]);
  });

  test('shows date and times in the time zone', () => {
    const { rows } = reportRows([entry({ start_time: '2026-09-30T22:30:00Z', end_time: '2026-09-30T23:15:00Z' })], { ...options, timeZone: 'Europe/Berlin' });

    expect(rows[0].slice(0, 3)).toEqual([{ text: '2026-10-01' }, { text: '00:30' }, { text: '01:15' }]);
  });

  test('puts an entry at 00:30 on the 1st on that date in the time zone, and on the day before in UTC', () => {
    const start = '2026-10-01T00:30:00+02:00';

    expect(reportRows([entry({ start_time: start })], { ...options, timeZone: 'Europe/Berlin' }).rows[0][0]).toEqual({ text: '2026-10-01' });
    expect(reportRows([entry({ start_time: start })], options).rows[0][0]).toEqual({ text: '2026-09-30' });
  });

  test('shows midnight as 00:00, not 24:00', () => {
    const { rows } = reportRows([entry({ start_time: '2026-09-21T00:00:00Z' })], options);

    expect(rows[0][1]).toEqual({ text: '00:00' });
  });

  test('accepts Date objects as read from the database', () => {
    const { rows } = reportRows([entry({ start_time: new Date('2026-09-21T08:00:00Z'), end_time: new Date('2026-09-21T09:00:00Z') })], options);

    expect(rows[0].slice(0, 3)).toEqual([{ text: '2026-09-21' }, { text: '08:00' }, { text: '09:00' }]);
    expect(rows[0][6]).toEqual({ number: '1.00' });
  });
});

describe('calculateHours and formatHoursNumber', () => {
  test('calculateHours gives two decimals, or 0 for a running entry', () => {
    expect(calculateHours('2026-09-21T08:00:00Z', '2026-09-21T09:30:00Z')).toBe('1.50');
    expect(calculateHours('2026-09-21T08:00:00Z', null)).toBe(0);
  });

  test('formatHoursNumber follows the active language', () => {
    activateLocale('de');
    expect(formatHoursNumber('1234.5')).toBe('1.234,50');
    activateLocale('en');
    expect(formatHoursNumber('1234.5')).toBe('1,234.50');
  });
});
