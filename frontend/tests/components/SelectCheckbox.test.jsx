import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import SelectCheckbox from '@/components/SelectCheckbox'

describe('SelectCheckbox', () => {
  test('is a checkbox named by its label, and shows whether it is checked', () => {
    const { rerender } = render(<SelectCheckbox label="Alle auswählen" checked={false} onChange={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: 'Alle auswählen' })).not.toBeChecked()

    rerender(<SelectCheckbox label="Alle auswählen" checked onChange={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: 'Alle auswählen' })).toBeChecked()
  })

  test('tells onChange the new state, with a click and with the space key', async () => {
    const onChange = vi.fn()
    render(<SelectCheckbox label="Eins" checked={false} onChange={onChange} />)

    await userEvent.click(screen.getByRole('checkbox'))
    screen.getByRole('checkbox').focus()
    await userEvent.keyboard(' ')

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenNthCalledWith(1, true)
  })

  test('is mixed when some are selected, and clear again afterwards', () => {
    const { rerender } = render(<SelectCheckbox label="Alle" checked={false} indeterminate onChange={vi.fn()} />)
    expect(screen.getByRole('checkbox').indeterminate).toBe(true)

    rerender(<SelectCheckbox label="Alle" checked={false} onChange={vi.fn()} />)
    expect(screen.getByRole('checkbox').indeterminate).toBe(false)
  })

  test('has no accessibility violations', async () => {
    const { container } = render(<SelectCheckbox label="Eins" checked onChange={vi.fn()} />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
