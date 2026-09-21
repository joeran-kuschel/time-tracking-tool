import { describe, expect, test } from 'vitest'
import { render, screen } from '../test/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../test/axe'
import LanguageSwitcher from './LanguageSwitcher'

describe('LanguageSwitcher', () => {
  test('labels each language in its own language and marks the active one', () => {
    render(<LanguageSwitcher />)

    const group = screen.getByRole('group', { name: 'Sprache' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deutsch' })).toHaveAttribute('lang', 'de')
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('lang', 'en')
    expect(screen.getByRole('button', { name: 'Deutsch' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('switches to English in place', async () => {
    render(<LanguageSwitcher />)

    await userEvent.click(screen.getByRole('button', { name: 'English' }))

    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.lang).toBe('en')
    expect(window.localStorage.getItem('language')).toBe('en')
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = render(<LanguageSwitcher />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
