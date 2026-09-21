import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '../test/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../test/axe'
import RecordActions from './RecordActions'

function renderActions(props) {
  return render(<RecordActions editLabel="Muster GmbH bearbeiten" deleteLabel="Muster GmbH löschen" onEdit={vi.fn()} onDelete={vi.fn()} {...props} />)
}

describe('RecordActions', () => {
  test('shows icons only, named for screen readers and as tooltip', () => {
    renderActions()

    for (const name of ['Muster GmbH bearbeiten', 'Muster GmbH löschen']) {
      const button = screen.getByRole('button', { name })
      expect(button).toHaveTextContent('')
      expect(button).toHaveAttribute('title', name)
      expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
      // The name comes from the title alone. With an aria-label as well, browsers would expose the
      // title as a description too. (jsdom always reports the title as description, so that part
      // is checked in a real browser.)
      expect(button).not.toHaveAttribute('aria-label')
    }
  })

  test('runs the edit and delete actions', async () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    renderActions({ onEdit, onDelete })

    await userEvent.click(screen.getByRole('button', { name: 'Muster GmbH bearbeiten' }))
    await userEvent.click(screen.getByRole('button', { name: 'Muster GmbH löschen' }))

    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = renderActions()
    expect(await axe(container)).toHaveNoViolations()
  })
})
