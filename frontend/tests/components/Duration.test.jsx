import { describe, expect, test } from 'vitest'
import { render, screen } from '../support/render'
import { axe } from '../support/axe'
import { i18n } from '@/i18n'
import Duration from '@/components/Duration'

describe('Duration', () => {
  test('shows h:mm h in a time element with the ISO duration', () => {
    render(<Duration minutes={239} />)

    const time = screen.getByText('3:59 h')
    expect(time.tagName).toBe('TIME')
    expect(time).toHaveAttribute('datetime', 'PT3H59M')
  })

  test('shows the same text in English', () => {
    i18n.activate('en')
    render(<Duration minutes={5} />)

    expect(screen.getByText('0:05 h')).toHaveAttribute('datetime', 'PT0H5M')
  })

  test('shows a negative duration as plain text, since it is no valid datetime', () => {
    const { container } = render(<Duration minutes={-90} />)

    expect(screen.getByText('-1:30 h')).toBeInTheDocument()
    expect(container.querySelector('time')).toBeNull()
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = render(<p><Duration minutes={239} /></p>)

    expect(await axe(container)).toHaveNoViolations()
  })
})
