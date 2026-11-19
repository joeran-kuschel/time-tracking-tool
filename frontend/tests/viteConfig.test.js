import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

// The config can't be imported here (it needs a file URL, the tests run in jsdom), so the source is read.
const source = readFileSync('vite.config.js', 'utf8')

describe('vite config', () => {
  it('serves the dev server on localhost only, not on every network interface', () => {
    expect(source).toMatch(/host:\s*'localhost'/)
    expect(source).not.toMatch(/host:\s*(true|'0\.0\.0\.0')/)
  })

  it('keeps the dev server on port 5173, the origin the CORS_ORIGIN of the browser review expects', () => {
    expect(source).toMatch(/port:\s*5173/)
  })
})
