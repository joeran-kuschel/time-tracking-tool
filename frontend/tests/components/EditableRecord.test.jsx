import { beforeEach, describe, expect, test, vi } from 'vitest'
import { msg } from '@lingui/core/macro'
import { render, screen } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import EditableRecord from '@/components/EditableRecord'
import { ApiError } from '@/api'

const item = { id: 2, name: 'Neu AG', email: 'info@neu.de' }
const form = {
  legend: 'Kunde bearbeiten',
  fields: [{ name: 'name', label: 'Name', required: true }, { name: 'email', label: 'E-Mail (optional)', type: 'email' }],
  toValues: (record) => ({ name: record.name, email: record.email }),
}
const messages = { saveFailed: msg`Customer could not be saved.`, deleteFailed: msg`Customer could not be deleted.`, stopTimerFirst: msg`Stop the running timer first.` }

function renderRecord(props) {
  return render(
    <>
      <EditableRecord item={item} form={form} onUpdate={vi.fn().mockResolvedValue({ id: 2 })} onDelete={vi.fn().mockResolvedValue({ id: 2 })}
        deleteMessage={(record) => `${record.name} löschen?`} messages={messages} {...props}>
        {(actions) => <div><h1>{item.name}</h1>{actions}</div>}
      </EditableRecord>
      <button type="button">Danach</button>
    </>
  )
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('EditableRecord', () => {
  test('renders the record with its edit and delete buttons', () => {
    renderRecord()

    expect(screen.getByRole('heading', { name: 'Neu AG' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Neu AG bearbeiten' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Neu AG löschen' })).toBeInTheDocument()
  })

  test('edits the record in place and returns focus to its edit button', async () => {
    const onUpdate = vi.fn().mockResolvedValue({ id: 2 })
    renderRecord({ onUpdate })

    await userEvent.click(screen.getByRole('button', { name: 'Neu AG bearbeiten' }))
    expect(screen.getByRole('group', { name: 'Kunde bearbeiten' })).toBeInTheDocument()
    const name = screen.getByLabelText('Name')
    expect(name).toHaveValue('Neu AG')
    expect(name).toHaveFocus()

    await userEvent.clear(name)
    await userEvent.type(name, 'Neu GmbH')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(onUpdate).toHaveBeenCalledWith(item, { name: 'Neu GmbH', email: 'info@neu.de' })
    expect(screen.getByRole('button', { name: 'Neu AG bearbeiten' })).toHaveFocus()
  })

  test('keeps the form open with an error when saving fails, and forgets the error after cancelling', async () => {
    renderRecord({ onUpdate: vi.fn().mockRejectedValue(new ApiError(500, 'boom')) })

    await userEvent.click(screen.getByRole('button', { name: 'Neu AG bearbeiten' }))
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Kunde konnte nicht gespeichert werden. Bitte versuche es erneut.')

    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Neu AG bearbeiten' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Neu AG bearbeiten' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('deletes after a confirmation and then calls onDeleted', async () => {
    const onDelete = vi.fn().mockResolvedValue({ id: 2 })
    const onDeleted = vi.fn(() => screen.getByRole('button', { name: 'Danach' }).focus())
    renderRecord({ onDelete, onDeleted })

    await userEvent.click(screen.getByRole('button', { name: 'Neu AG löschen' }))
    expect(screen.getByRole('group', { name: 'Neu AG löschen?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }))

    expect(onDelete).toHaveBeenCalledWith(item)
    expect(onDeleted).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Danach' })).toHaveFocus()
  })

  test('cancelling the deletion returns focus to the delete button', async () => {
    const onDelete = vi.fn()
    renderRecord({ onDelete })

    await userEvent.click(screen.getByRole('button', { name: 'Neu AG löschen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Neu AG löschen' })).toHaveFocus()
  })

  test('explains that a running timer blocks the deletion', async () => {
    renderRecord({ onDelete: vi.fn().mockRejectedValue(new ApiError(409, 'Stop the running timer before deleting')) })

    await userEvent.click(screen.getByRole('button', { name: 'Neu AG löschen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Kunde konnte nicht gelöscht werden. Stoppe zuerst den laufenden Timer.')
  })

  test('has no detectable accessibility violations in all modes', async () => {
    const { container } = renderRecord()
    expect(await axe(container)).toHaveNoViolations()

    await userEvent.click(screen.getByRole('button', { name: 'Neu AG bearbeiten' }))
    expect(await axe(container)).toHaveNoViolations()

    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Neu AG löschen' }))
    expect(await axe(container)).toHaveNoViolations()
  })
})
