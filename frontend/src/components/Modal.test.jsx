import { describe, expect, test, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '../test/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../test/axe'
import Modal from './Modal'

// Opens the modal from a button, like the Time tracking page does
function Harness({ onClose = () => {} }) {
  const [open, setOpen] = useState(false)
  const close = () => {
    onClose()
    setOpen(false)
  }
  return (
    <>
      <button onClick={() => setOpen(true)}>Neuer Kunde</button>
      <Modal title="Neuer Kunde" open={open} onClose={close}>
        <label htmlFor="name">Name</label>
        <input id="name" />
        <button onClick={close}>Abbrechen</button>
      </Modal>
    </>
  )
}

describe('Modal', () => {
  test('opens as a modal dialog named by its title', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    render(<Harness />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Neuer Kunde' }))

    expect(showModal).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog', { name: 'Neuer Kunde' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveFocus()
    showModal.mockRestore()
  })

  test('closes with its own button and returns focus to the opener', async () => {
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Neuer Kunde' })

    await userEvent.click(opener)
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  test("Escape (the dialog's cancel event) closes it through onClose", async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Neuer Kunde' }))

    const cancel = new Event('cancel', { cancelable: true })
    screen.getByRole('dialog').dispatchEvent(cancel)

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(cancel.defaultPrevented).toBe(true)
  })

  test('starts fresh every time it opens', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Neuer Kunde' }))
    await userEvent.type(screen.getByLabelText('Name'), 'Muster')
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))

    await userEvent.click(screen.getByRole('button', { name: 'Neuer Kunde' }))
    expect(screen.getByLabelText('Name')).toHaveValue('')
  })

  test('has no detectable accessibility violations while open', async () => {
    const { container } = render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Neuer Kunde' }))
    expect(await axe(container)).toHaveNoViolations()
  })
})
