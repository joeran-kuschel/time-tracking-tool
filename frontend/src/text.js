// Cleans typed text before it is sent: control characters become spaces (a pasted tab, for example; a multi-line text
// keeps its line breaks), and the ends are trimmed. Returns null for an empty text, which the API takes as "not set".
// The backend refuses text with other control characters or with spaces at the ends (config/settingsOptions.js).
/* eslint-disable no-control-regex */
const SINGLE_LINE = /[\u0000-\u001f\u007f]/g
const MULTI_LINE = /[\u0000-\u0009\u000b-\u001f\u007f]/g
/* eslint-enable no-control-regex */

export function cleanText(value, { multiline = false } = {}) {
  const text = (value ?? '').replace(multiline ? MULTI_LINE : SINGLE_LINE, ' ').trim()
  return text === '' ? null : text
}

// The number of lines of a text (an empty text has none)
export const lineCount = (text) => (text ? text.split('\n').length : 0)
