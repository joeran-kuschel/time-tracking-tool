import { describe, expect, test } from 'vitest'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { renderWithRouter as render, screen } from '../support/render'
import { axe } from '../support/axe'
import MissingRecord from '@/components/MissingRecord'

const props = { message: 'Dieser Kunde existiert nicht (mehr).', to: '/time-tracking', linkText: 'Zurück zu Zeiterfassung' }

describe('MissingRecord', () => {
  test('announces the message as an alert and links to the way out', () => {
    render(<MissingRecord {...props} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Dieser Kunde existiert nicht (mehr).')
    expect(screen.getByRole('link', { name: 'Zurück zu Zeiterfassung' })).toHaveAttribute('href', '/time-tracking')
  })

  test('opens the address of the link when it is used with the keyboard', async () => {
    render(
      <Routes>
        <Route path="/" element={<MissingRecord {...props} />} />
        <Route path="/time-tracking" element={<p>Zeiterfassung offen</p>} />
      </Routes>
    )

    await userEvent.tab()
    expect(screen.getByRole('link')).toHaveFocus()
    await userEvent.keyboard('{Enter}')

    expect(screen.getByText('Zeiterfassung offen')).toBeInTheDocument()
  })

  test('has no accessibility violations', async () => {
    const { container } = render(<MissingRecord {...props} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
