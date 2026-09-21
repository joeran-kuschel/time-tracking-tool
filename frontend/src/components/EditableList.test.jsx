import { beforeEach, describe, expect, test, vi } from 'vitest'
import { msg } from '@lingui/core/macro'
import { render, screen } from '../test/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../test/axe'
import EditableList from './EditableList'
import { ApiError } from '../api'

const items = [{ id: 1, name: 'Muster GmbH', email: '' }, { id: 2, name: 'Neu AG', email: 'info@neu.de' }]
const form = {
  fields: [{ name: 'name', label: 'Name', required: true }, { name: 'email', label: 'E-Mail (optional)', type: 'email' }],
  toValues: (item) => ({ name: item.name, email: item.email }),
}
const messages = { saveFailed: msg`Customer could not be saved.`, deleteFailed: msg`Customer could not be deleted.`, stopTimerFirst: msg`Stop the running timer first.` }

function renderList(props) {
  return render(
    <EditableList label="Kunden" items={items} selectedId={1} onSelect={vi.fn()} renderItem={(item) => item.name}
      form={form} onUpdate={vi.fn().mockResolvedValue({ id: 1 })} onDelete={vi.fn().mockResolvedValue({ id: 1 })}
      deleteMessage={(item) => `${item.name} löschen?`} messages={messages} {...props} />
  )
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('EditableList', () => {
  test('marks the selected item and selects another one', async () => {
    const onSelect = vi.fn()
    renderList({ onSelect })

    expect(screen.getByRole('button', { name: 'Muster GmbH' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Neu AG' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Neu AG' }))
    expect(onSelect).toHaveBeenCalledWith(items[1])
  })

  test('edits an item in place and returns focus to its edit button', async () => {
    const onUpdate = vi.fn().mockResolvedValue({ id: 2 })
    renderList({ onUpdate })

    await userEvent.click(screen.getByRole('button', { name: 'Neu AG bearbeiten' }))
    const name = screen.getByLabelText('Name')
    expect(name).toHaveValue('Neu AG')
    expect(name).toHaveFocus()

    await userEvent.clear(name)
    await userEvent.type(name, 'Neu GmbH')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(onUpdate).toHaveBeenCalledWith(items[1], { name: 'Neu GmbH', email: 'info@neu.de' })
    expect(screen.getByRole('button', { name: 'Neu AG bearbeiten' })).toHaveFocus()
  })

  test('keeps the form open with an error when saving fails, and forgets the error after cancelling', async () => {
    renderList({ onUpdate: vi.fn().mockRejectedValue(new ApiError(500, 'boom')) })

    await userEvent.click(screen.getByRole('button', { name: 'Muster GmbH bearbeiten' }))
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Kunde konnte nicht gespeichert werden. Bitte versuche es erneut.')

    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Muster GmbH bearbeiten' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Muster GmbH bearbeiten' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('deletes after a confirmation and moves focus to the list', async () => {
    const onDelete = vi.fn().mockResolvedValue({ id: 2 })
    renderList({ onDelete })

    await userEvent.click(screen.getByRole('button', { name: 'Neu AG löschen' }))
    expect(screen.getByRole('group', { name: 'Neu AG löschen?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }))

    expect(onDelete).toHaveBeenCalledWith(items[1])
    expect(screen.getByRole('list', { name: 'Kunden' })).toHaveFocus()
  })

  test('cancelling the deletion returns focus to the delete button', async () => {
    const onDelete = vi.fn()
    renderList({ onDelete })

    await userEvent.click(screen.getByRole('button', { name: 'Neu AG löschen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Neu AG löschen' })).toHaveFocus()
  })

  test('explains that a running timer blocks the deletion', async () => {
    renderList({ onDelete: vi.fn().mockRejectedValue(new ApiError(409, 'Stop the running timer before deleting')) })

    await userEvent.click(screen.getByRole('button', { name: 'Muster GmbH löschen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Kunde konnte nicht gelöscht werden. Stoppe zuerst den laufenden Timer.')
  })

  test('has no detectable accessibility violations in all modes', async () => {
    const { container } = renderList()
    expect(await axe(container)).toHaveNoViolations()

    await userEvent.click(screen.getByRole('button', { name: 'Neu AG bearbeiten' }))
    expect(await axe(container)).toHaveNoViolations()

    await userEvent.click(screen.getByRole('button', { name: 'Muster GmbH löschen' }))
    expect(await axe(container)).toHaveNoViolations()
  })
})
