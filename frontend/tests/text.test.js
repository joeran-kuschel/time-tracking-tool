import { describe, expect, test } from 'vitest'
import { cleanText, lineCount } from '@/text'

describe('cleanText', () => {
  test.each([
    ['  Jana  ', 'Jana'],
    ['a\tb', 'a b'],
    ['a\u0000b\u001fc\u007fd', 'a b c d'],
    ['a\nb', 'a b'],
    ['a\r\nb', 'a  b'],
  ])('a single line %j becomes %j', (value, expected) => {
    expect(cleanText(value)).toBe(expected)
  })

  test.each([
    ['Musterweg 1\n12345 Beispielstadt', 'Musterweg 1\n12345 Beispielstadt'],
    ['  1\n2  ', '1\n2'],
    ['a\tb\nc', 'a b\nc'],
    ['a\u0000b\nc', 'a b\nc'],
  ])('a multi-line text %j keeps its line breaks: %j', (value, expected) => {
    expect(cleanText(value, { multiline: true })).toBe(expected)
  })

  test.each([[''], ['   '], ['\t'], [null], [undefined], ['\n\n']])('%j is null (not set)', (value) => {
    expect(cleanText(value, { multiline: true })).toBeNull()
    expect(cleanText(value)).toBeNull()
  })

  test('does not change the text the backend accepts', () => {
    expect(cleanText('DE123456789')).toBe('DE123456789')
  })
})

describe('lineCount', () => {
  test.each([[null, 0], [undefined, 0], ['', 0], ['a', 1], ['a\nb', 2], ['a\n\nb', 3], ['1\n2\n3\n4\n5\n6\n7', 7]])('%j has %i lines', (text, count) => {
    expect(lineCount(text)).toBe(count)
  })
})
