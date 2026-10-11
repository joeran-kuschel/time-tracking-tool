import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { applyTheme, saveTheme, storedTheme, watchSystemTheme } from '@/theme'

// jsdom has no matchMedia; this one answers the dark-mode query with `dark` and remembers its listener
function mockSystem(dark) {
  const query = { matches: dark, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  window.matchMedia = vi.fn(() => query)
  return query
}

beforeEach(() => {
  delete document.documentElement.dataset.theme
})

afterEach(() => {
  delete window.matchMedia
})

describe('theme', () => {
  test('follows the system until a theme is chosen', () => {
    expect(storedTheme()).toBe('system')
    window.localStorage.setItem('theme', 'dark')
    expect(storedTheme()).toBe('dark')
    window.localStorage.setItem('theme', 'purple')
    expect(storedTheme()).toBe('system')
  })

  test('applies the chosen theme, or the system one', () => {
    mockSystem(true)
    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    applyTheme('system')
    expect(document.documentElement.dataset.theme).toBe('dark')

    mockSystem(false)
    applyTheme('system')
    expect(document.documentElement.dataset.theme).toBe('light')
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  test('is light when the browser cannot tell the system theme', () => {
    applyTheme('system')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  test('saves and applies a choice', () => {
    saveTheme('dark')
    expect(window.localStorage.getItem('theme')).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  test('watches the system theme until stopped', () => {
    const query = mockSystem(false)
    const onChange = vi.fn()

    const stop = watchSystemTheme(onChange)
    expect(query.addEventListener).toHaveBeenCalledWith('change', onChange)
    stop()
    expect(query.removeEventListener).toHaveBeenCalledWith('change', onChange)
  })
})
