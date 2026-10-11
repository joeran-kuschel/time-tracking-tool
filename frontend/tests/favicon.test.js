import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

describe('favicon', () => {
  test('index.html links the clock favicon', () => {
    expect(read('../index.html')).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')
  })

  test('is a valid SVG with a viewBox, in the accent color for light and dark tabs', () => {
    const svg = new DOMParser().parseFromString(read('../public/favicon.svg'), 'image/svg+xml')

    expect(svg.querySelector('parsererror')).toBeNull()
    expect(svg.documentElement.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(svg.querySelector('path')).not.toBeNull()
    const style = svg.querySelector('style').textContent
    expect(style).toContain('#0E5C58')
    expect(style).toMatch(/prefers-color-scheme: dark\) \{ path \{ stroke: #5DB3AB; \}/)
  })
})
