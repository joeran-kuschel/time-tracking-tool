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
