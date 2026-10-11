import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import ConfirmDelete from '@/components/ConfirmDelete'

describe('ConfirmDelete', () => {
  test('asks in a named group and starts on Cancel', () => {
    render(<ConfirmDelete message="Muster GmbH löschen?" onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByRole('group', { name: 'Muster GmbH löschen?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus()
  })

  test('confirms, cancels and cancels with Escape', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmDelete message="Löschen?" onConfirm={onConfirm} onCancel={onCancel} />)

    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }))
    expect(onConfirm).toHaveBeenCalled()
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = render(<ConfirmDelete message="Löschen?" onConfirm={vi.fn()} onCancel={vi.fn()} error="Fehler." />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
