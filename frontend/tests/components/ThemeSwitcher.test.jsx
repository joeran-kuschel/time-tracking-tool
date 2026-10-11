import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, render, screen } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import ThemeSwitcher from '@/components/ThemeSwitcher'

// A system in light mode whose theme the test can switch
function mockSystem() {
  const query = {
    matches: false,
    listeners: [],
    addEventListener: (_, fn) => query.listeners.push(fn),
    removeEventListener: (_, fn) => { query.listeners = query.listeners.filter((l) => l !== fn) },
  }
  window.matchMedia = vi.fn(() => query)
  return {
    switchTo(dark) {
      query.matches = dark
      query.listeners.forEach((fn) => fn())
    },
  }
}

beforeEach(() => {
  delete document.documentElement.dataset.theme
})

afterEach(() => {
  delete window.matchMedia
})

describe('ThemeSwitcher', () => {
  test('offers light, dark and the system theme, and starts with the system', () => {
    render(<ThemeSwitcher />)

    expect(screen.getByRole('group', { name: 'Farbschema' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hell' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Dunkel' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Wie das System' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('switches to dark without a reload and remembers it', async () => {
    render(<ThemeSwitcher />)

    await userEvent.click(screen.getByRole('button', { name: 'Dunkel' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(window.localStorage.getItem('theme')).toBe('dark')
    expect(screen.getByRole('button', { name: 'Dunkel' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('starts with the stored choice', () => {
    window.localStorage.setItem('theme', 'light')
    render(<ThemeSwitcher />)
    expect(screen.getByRole('button', { name: 'Hell' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('follows the system while that is chosen', async () => {
    const system = mockSystem()
    render(<ThemeSwitcher />)

    act(() => system.switchTo(true))
    expect(document.documentElement.dataset.theme).toBe('dark')

    await userEvent.click(screen.getByRole('button', { name: 'Hell' }))
    act(() => system.switchTo(true))
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = render(<ThemeSwitcher />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
