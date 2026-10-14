import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { ui } from '@/ui'

const css = readFileSync('src/index.css', 'utf8')

describe('select styling', () => {
  test('hides the native arrow and keeps room for the chevron to the right', () => {
    const classes = ui.select.split(' ')
    expect(classes).toContain('appearance-none')
    expect(classes).toContain('pr-11')
    expect(classes).toContain('bg-[position:right_1rem_center]')
    expect(classes).toContain('bg-[image:var(--select-chevron)]')
  })

  test('defines the chevron for the light and the dark theme', () => {
    const light = css.slice(css.indexOf(':root {'), css.indexOf(":root[data-theme='dark']"))
    const dark = css.slice(css.indexOf(":root[data-theme='dark']"))
    expect(light).toContain('--select-chevron:')
    expect(dark).toContain('--select-chevron:')
    expect(light.match(/--select-chevron:.*/)[0]).not.toBe(dark.match(/--select-chevron:.*/)[0])
  })

  test('gives the native arrow back in forced-colors mode', () => {
    const classes = ui.select.split(' ')
    expect(classes).toContain('forced-colors:appearance-auto')
    expect(classes).toContain('forced-colors:bg-none')
  })

  test.each([
    ['light', ':root {', ":root[data-theme='dark']"],
    ['dark', ":root[data-theme='dark']", undefined],
  ])('the %s chevron has the ink color of the theme', (theme, from, to) => {
    const block = css.slice(css.indexOf(from), to ? css.indexOf(to) : undefined)
    const ink = block.match(/--color-ink:[^/]*\/\*\s*#([0-9A-Fa-f]{6})/)[1]
    expect(block.match(/--select-chevron:.*/)[0]).toContain(`stroke='%23${ink}'`)
  })
})
