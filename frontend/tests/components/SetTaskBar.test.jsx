import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import SetTaskBar from '@/components/SetTaskBar'

function renderBar(props) {
  return render(<SetTaskBar count={3} onApply={vi.fn().mockResolvedValue(true)} onClear={vi.fn()} {...props} />)
}

describe('SetTaskBar', () => {
  test('shows nothing but the empty status line when nothing is selected', () => {
    const { container } = renderBar({ count: 0 })

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(container.querySelector('[aria-live="polite"]')).toBeEmptyDOMElement()
  })

  test('says how many entries are selected, with the singular', () => {
    const { rerender } = renderBar({ count: 3 })
    expect(screen.getByText('3 Einträge ausgewählt')).toBeInTheDocument()

    rerender(<SetTaskBar count={1} onApply={vi.fn()} onClear={vi.fn()} />)
    expect(screen.getByText('1 Eintrag ausgewählt')).toBeInTheDocument()
  })

  test('Clear selection calls onClear', async () => {
    const onClear = vi.fn()
    renderBar({ onClear })

    await userEvent.click(screen.getByRole('button', { name: 'Auswahl aufheben' }))

    expect(onClear).toHaveBeenCalled()
  })

  test('Set task opens the question with the field focused, and says what changes and what does not', async () => {
    renderBar({ count: 3 })

    await userEvent.click(screen.getByRole('button', { name: 'Aufgabe setzen' }))

    expect(screen.getByLabelText('Aufgabe')).toHaveFocus()
    expect(screen.getByText(/Die Aufgabe von 3 Einträgen wird geändert\./)).toBeInTheDocument()
    expect(screen.getByText(/Beschreibungen, Zeiten und Projekte bleiben, wie sie sind\./)).toBeInTheDocument()
  })

  test('Apply sends the typed task; the field is emptied after a success', async () => {
    const onApply = vi.fn().mockResolvedValue(true)
    renderBar({ onApply })
    await userEvent.click(screen.getByRole('button', { name: 'Aufgabe setzen' }))

    await userEvent.type(screen.getByLabelText('Aufgabe'), 'Fix login')
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }))

    expect(onApply).toHaveBeenCalledWith('Fix login')
  })

  test('an empty field is sent too (it removes the task)', async () => {
    const onApply = vi.fn().mockResolvedValue(true)
    renderBar({ onApply })
    await userEvent.click(screen.getByRole('button', { name: 'Aufgabe setzen' }))

    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }))

    expect(onApply).toHaveBeenCalledWith('')
  })

  test('keeps the question open with what was typed, and shows the error, when applying fails', async () => {
    renderBar({ onApply: vi.fn().mockResolvedValue(false), error: 'Die Aufgabe konnte nicht gesetzt werden. Bitte versuche es erneut.' })
    await userEvent.click(screen.getByRole('button', { name: 'Aufgabe setzen' }))
    await userEvent.type(screen.getByLabelText('Aufgabe'), 'Fix login')

    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }))

    expect(screen.getByLabelText('Aufgabe')).toHaveValue('Fix login')
    expect(screen.getByRole('alert')).toHaveTextContent('Die Aufgabe konnte nicht gesetzt werden.')
  })

  test('Cancel and Escape close the question and give the focus back to Set task', async () => {
    renderBar()
    await userEvent.click(screen.getByRole('button', { name: 'Aufgabe setzen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(await screen.findByRole('button', { name: 'Aufgabe setzen' })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Aufgabe setzen' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByLabelText('Aufgabe')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Aufgabe setzen' })).toHaveFocus()
  })

  test('offers the suggestions, and none when there are none', async () => {
    const { container } = renderBar({ suggestions: ['Fix login', 'Review'] })
    await userEvent.click(screen.getByRole('button', { name: 'Aufgabe setzen' }))

    expect([...container.querySelectorAll('datalist option')].map((o) => o.value)).toEqual(['Fix login', 'Review'])
    expect(screen.getByLabelText('Aufgabe')).toHaveAttribute('maxlength', '100')
  })

  test('has no list attribute without suggestions', async () => {
    renderBar({ suggestions: [] })
    await userEvent.click(screen.getByRole('button', { name: 'Aufgabe setzen' }))

    expect(screen.getByLabelText('Aufgabe')).not.toHaveAttribute('list')
  })

  test('marks Apply as disabled while the request is sent', async () => {
    renderBar({ busy: true })
    await userEvent.click(screen.getByRole('button', { name: 'Aufgabe setzen' }))

    expect(screen.getByRole('button', { name: 'Übernehmen' })).toHaveAttribute('aria-disabled', 'true')
  })

  test('after a success the status line says it and takes the focus', () => {
    const { container, rerender } = renderBar({ count: 2 })
    rerender(<SetTaskBar count={0} done={{ count: 2 }} onApply={vi.fn()} onClear={vi.fn()} />)

    const status = container.querySelector('[aria-live="polite"]')
    expect(status).toHaveTextContent('Aufgabe für 2 Einträge geändert.')
    expect(status).toHaveFocus()
  })

  test('the status line says it in the singular, and the old message goes when a new selection starts', () => {
    const { container, rerender } = renderBar({ count: 0, done: { count: 1 } })
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('Aufgabe für 1 Eintrag geändert.')

    rerender(<SetTaskBar count={1} done={{ count: 1 }} onApply={vi.fn()} onClear={vi.fn()} />)
    expect(container.querySelector('[aria-live="polite"]')).toBeEmptyDOMElement()
  })

  test('closes the question when the selection is emptied', async () => {
    const { rerender } = renderBar()
    await userEvent.click(screen.getByRole('button', { name: 'Aufgabe setzen' }))

    rerender(<SetTaskBar count={0} onApply={vi.fn()} onClear={vi.fn()} />)

    expect(screen.queryByLabelText('Aufgabe')).not.toBeInTheDocument()
  })

  test('has no accessibility violations, closed and open', async () => {
    const { container } = renderBar({ suggestions: ['Fix login'] })
    expect(await axe(container)).toHaveNoViolations()

    await userEvent.click(screen.getByRole('button', { name: 'Aufgabe setzen' }))
    expect(await axe(container)).toHaveNoViolations()
  })
})
