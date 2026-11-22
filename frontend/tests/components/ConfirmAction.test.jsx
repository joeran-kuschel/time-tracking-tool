import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import ConfirmAction from '@/components/ConfirmAction'

const renderAsk = (props) => render(<ConfirmAction message="Rechnung erstellen?" confirmLabel="Erstellen" onConfirm={vi.fn()} onCancel={vi.fn()} {...props} />)

describe('ConfirmAction', () => {
  test('asks in a named group and starts on Cancel, the safe choice', () => {
    renderAsk()

    expect(screen.getByRole('group', { name: 'Rechnung erstellen?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus()
  })

  test('the confirming button has the label it is given, and confirms', async () => {
    const onConfirm = vi.fn()
    renderAsk({ onConfirm })

    await userEvent.click(screen.getByRole('button', { name: 'Erstellen' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  test('cancels with the button and with Escape, and does not confirm', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    renderAsk({ onConfirm, onCancel })

    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))

    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  test('is not the red button of a deletion', () => {
    renderAsk()

    expect(screen.getByRole('button', { name: 'Erstellen' }).className).toContain('bg-accent')
    expect(screen.getByRole('button', { name: 'Erstellen' }).className).not.toContain('bg-danger')
  })

  test('marks the confirming button disabled while busy', () => {
    renderAsk({ busy: true })

    expect(screen.getByRole('button', { name: 'Erstellen' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Abbrechen' })).not.toHaveAttribute('aria-disabled')
  })

  test('shows an error with role alert', () => {
    renderAsk({ error: 'Fehler.' })

    expect(screen.getByRole('alert')).toHaveTextContent('Fehler.')
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = renderAsk({ error: 'Fehler.' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
