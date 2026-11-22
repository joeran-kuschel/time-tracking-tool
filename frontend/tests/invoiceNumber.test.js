import { describe, expect, test } from 'vitest'
import { formatInvoiceNumber, parseInvoiceNumber, patternProblem, previewInvoiceNumber } from '@/invoiceNumber'

// The same table is in backend/tests/invoiceNumber.test.js: this preview must agree with the number the backend makes
const FORMATS = [
  ['{YYYY}-{NNNN}', 1, '2026-0001'],
  ['{YYYY}-{NNNN}', 42, '2026-0042'],
  ['{YY}{MM}-{NNN}', 7, '2603-007'],
  ['RE/{YYYY}/{MM}/{NN}', 5, 'RE/2026/03/05'],
  ['{NNNN}', 12345, '12345'],
  ['Rechnung {N}', 9, 'Rechnung 9'],
  ['{NNNNNNNN}', 1, '00000001'],
]

describe('invoice number pattern', () => {
  test.each(FORMATS)('%s with %i makes %s (March 2026)', (pattern, number, expected) => {
    expect(formatInvoiceNumber(pattern, number, new Date('2026-03-04T10:00:00Z'))).toBe(expected)
  })

  test('uses the UTC date, like the backend', () => {
    expect(formatInvoiceNumber('{YYYY}-{MM}-{NN}', 1, new Date('2027-01-01T00:05:00Z'))).toBe('2027-01-01')
    expect(formatInvoiceNumber('{YYYY}-{MM}-{NN}', 1, new Date('2026-12-31T23:55:00Z'))).toBe('2026-12-01')
  })

  test.each([['{YYYY}-{NNNN}'], ['{NNNN}'], ['RE-{NNNN}'], ['{YY}{MM}{N}'], ['a b.c_d/e-{NN}'], ['{NNNNNNNN}'], ['x'.repeat(37) + '{N}']])('accepts %j', (pattern) => {
    expect(patternProblem(pattern)).toBeNull()
  })

  test.each([
    ['', 'text'], [' {NNNN}', 'text'], ['{NNNN} ', 'text'], [null, 'text'], [5, 'text'], [undefined, 'text'], ['x'.repeat(41), 'text'],
    ['{YYYY}', 'counter'], ['{NNNN}{NN}', 'counter'], ['RE', 'counter'], ['{YYYY}-{MM}', 'counter'],
    ['{NNNNNNNNN}', 'characters'], ['{}{NNNN}', 'characters'], ['{nnnn}', 'characters'], ['{DD}-{NNNN}', 'characters'],
    ['#{NNNN}', 'characters'], ['{NNNN}\n', 'text'], ['a\nb{NNNN}', 'characters'], ['Ä{NNNN}', 'characters'], ['{YYYY-{NNNN}', 'characters'],
  ])('refuses %j (%s)', (pattern, problem) => {
    expect(patternProblem(pattern)).toBe(problem)
  })

  test.each([['1', 1], ['42', 42], [' 7 ', 7], [5, 5], ['99999999', 99999999]])('reads %j as %i', (value, expected) => {
    expect(parseInvoiceNumber(value)).toBe(expected)
  })

  test.each([[''], ['0'], ['-1'], ['1.5'], ['1,5'], ['abc'], ['100000000'], [null], [undefined], [0], [1.5]])('does not read %j', (value) => {
    expect(parseInvoiceNumber(value)).toBeUndefined()
  })

  describe('the preview', () => {
    const now = new Date('2026-11-22T10:00:00Z')

    test('shows the number from the typed pattern and number', () => {
      expect(previewInvoiceNumber({ invoiceNumberPattern: '{YYYY}-{NNNN}', invoiceNextNumber: '17' }, now)).toBe('2026-0017')
      expect(previewInvoiceNumber({ invoiceNumberPattern: ' RE-{NNN} ', invoiceNextNumber: 3 }, now)).toBe('RE-003')
    })

    test.each([
      [{ invoiceNumberPattern: '{YYYY}', invoiceNextNumber: 1 }],
      [{ invoiceNumberPattern: '', invoiceNextNumber: 1 }],
      [{ invoiceNumberPattern: '{NNNN}', invoiceNextNumber: '' }],
      [{ invoiceNumberPattern: '{NNNN}', invoiceNextNumber: 'x' }],
      [{ invoiceNextNumber: 1 }],
      [{}],
    ])('shows nothing for %j', (values) => {
      expect(previewInvoiceNumber(values, now)).toBeNull()
    })
  })
})
