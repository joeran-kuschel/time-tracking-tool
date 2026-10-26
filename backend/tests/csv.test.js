const { toCsv } = require('../src/utils/csv');

const text = (value) => ({ text: value });
const number = (value) => ({ number: value });
const table = (...rows) => ({ headers: ['A', 'B'], rows });
const bodyLine = (csv) => csv.split('\r\n')[1];

describe('toCsv', () => {
  test('starts with a UTF-8 BOM and uses CRLF line endings, also after the last line', () => {
    const csv = toCsv(table([text('x'), text('y')]), 'en');

    expect(csv).toBe('﻿A,B\r\nx,y\r\n');
  });

  test('writes only the header line for a table without rows', () => {
    expect(toCsv(table(), 'de')).toBe('﻿A;B\r\n');
  });

  test.each([
    ['de', ';'],
    ['en', ','],
    ['fr', ';'],
    [undefined, ';'],
  ])('uses the delimiter of the language %p', (locale, delimiter) => {
    expect(toCsv(table([text('x'), text('y')]), locale)).toBe(`﻿A${delimiter}B\r\nx${delimiter}y\r\n`);
  });

  test('quotes a field that contains the delimiter, but not the other delimiter', () => {
    expect(bodyLine(toCsv(table([text('a;b'), text('c,d')]), 'de'))).toBe('"a;b";c,d');
    expect(bodyLine(toCsv(table([text('a;b'), text('c,d')]), 'en'))).toBe('a;b,"c,d"');
  });

  test('quotes a number with a decimal comma only where the comma is the delimiter', () => {
    expect(bodyLine(toCsv(table([text('x'), number('1,50')]), 'de'))).toBe('x;1,50');
    expect(bodyLine(toCsv(table([text('x'), number('1,50')]), 'en'))).toBe('x,"1,50"');
  });

  test('quotes a field with a quote and doubles the quote', () => {
    expect(bodyLine(toCsv(table([text('say "hi"'), text('x')]), 'en'))).toBe('"say ""hi""",x');
  });

  test.each([['a\nb'], ['a\r\nb'], ['a\rb']])('quotes a field with the line break %j', (value) => {
    expect(toCsv(table([text(value), text('x')]), 'en')).toBe(`﻿A,B\r\n"${value}",x\r\n`);
  });

  test.each([['=SUM(A1)'], ['+1'], ['-1'], ['@cmd'], ['\tx']])('prefixes the text %j with a quote against formulas', (value) => {
    expect(bodyLine(toCsv(table([text(value), text('x')]), 'en'))).toBe(`'${value},x`);
  });

  test('prefixes a text that starts with a carriage return and quotes it as well', () => {
    expect(toCsv(table([text('\rx'), text('y')]), 'en')).toBe('﻿A,B\r\n"\'\rx",y\r\n');
  });

  test('prefixes before it quotes', () => {
    expect(bodyLine(toCsv(table([text('=1,2'), text('x')]), 'en'))).toBe(`"'=1,2",x`);
  });

  test('leaves a text alone that only contains a formula character later', () => {
    expect(bodyLine(toCsv(table([text('a=b'), text('x-y')]), 'en'))).toBe('a=b,x-y');
  });

  test('never prefixes a number', () => {
    expect(bodyLine(toCsv(table([number('-1.50'), number('+2')]), 'en'))).toBe('-1.50,+2');
  });

  test('protects the header texts like any other text', () => {
    expect(toCsv({ headers: ['=A'], rows: [] }, 'en')).toBe("﻿'=A\r\n");
  });

  test('keeps Unicode characters', () => {
    expect(bodyLine(toCsv(table([text('Łódź'), text('5 €')]), 'en'))).toBe('Łódź,5 €');
  });
});

describe('toCsv with amounts', () => {
  const { reportRows } = require('../src/utils/reportRows');
  const entries = [{ start_time: '2026-03-02T08:00:00Z', end_time: '2026-03-02T09:30:00Z', project_name: 'Web', description: 'x', hourly_rate: '80.00' }];
  const options = { customerName: 'Muster', timeZone: 'UTC', amounts: true };

  test('writes the rate and the amount as plain numbers, with the delimiter of the language', () => {
    const de = toCsv(reportRows(entries, { ...options, locale: 'de' }), 'de').slice(1).split('\r\n');
    const en = toCsv(reportRows(entries, { ...options, locale: 'en' }), 'en').slice(1).split('\r\n');

    expect(de).toEqual(['Datum;Beginn;Ende;Kunde;Projekt;Beschreibung;Stunden;Stundensatz (EUR/h);Betrag (EUR)', '2026-03-02;08:00;09:30;Muster;Web;x;1,50;80,00;120,00', '']);
    expect(en).toEqual(['Date,Start,End,Customer,Project,Description,Hours,Rate (EUR/h),Amount (EUR)', '2026-03-02,08:00,09:30,Muster,Web,x,1.50,80.00,120.00', '']);
  });

  test('quotes an English amount with a thousands separator', () => {
    const big = [{ ...entries[0], hourly_rate: '1000.00' }];

    expect(bodyLine(toCsv(reportRows(big, { ...options, locale: 'en' }), 'en'))).toBe('2026-03-02,08:00,09:30,Muster,Web,x,1.50,"1,000.00","1,500.00"');
  });
});

describe('toCsv with amounts: large values and protection', () => {
  const { reportRows } = require('../src/utils/reportRows');
  const base = { start_time: '2026-03-02T08:00:00Z', end_time: '2026-03-02T18:00:00Z', project_name: 'Web', description: 'x', hourly_rate: '1403.10' };
  const options = { customerName: 'Muster', timeZone: 'UTC', amounts: true };

  test('writes German thousands with a dot and needs no quotes, because the delimiter is ";"', () => {
    const line = bodyLine(toCsv(reportRows([base], { ...options, locale: 'de' }), 'de'));

    expect(line).toBe('2026-03-02;08:00;18:00;Muster;Web;x;10,00;1.403,10;14.031,00');
  });

  test('quotes both English values with a thousands separator, and nothing else', () => {
    const line = bodyLine(toCsv(reportRows([base], { ...options, locale: 'en' }), 'en'));

    expect(line).toBe('2026-03-02,08:00,18:00,Muster,Web,x,10.00,"1,403.10","14,031.00"');
  });

  test('contains no no-break space and no currency sign, only digits and separators', () => {
    for (const locale of ['de', 'en']) {
      const csv = toCsv(reportRows([base], { ...options, locale }), locale);

      expect(csv).not.toMatch(/[\u00a0\u202f€]/);
    }
  });

  test('still protects texts against formulas, and a negative number is written as is', () => {
    const entries = [{ ...base, description: '=1+1', project_name: '@Web' }];
    const line = bodyLine(toCsv(reportRows(entries, { ...options, locale: 'en' }), 'en'));

    expect(line).toContain(",'@Web,'=1+1,");
  });
});
