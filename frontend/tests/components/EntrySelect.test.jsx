import { describe, expect, test } from 'vitest'
import { act, render, screen } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import EntrySelect from '@/components/EntrySelect'
import { useSelection } from '@/hooks/useSelection'
import { switchLocale } from '@/i18n'

const finished = { id: 4, start_time: '2026-09-22T08:00:00Z', end_time: '2026-09-22T09:00:00Z', description: null, task: null }

function Harness({ entry = finished }) {
  const selection = useSelection()
  return (
    <>
      <p data-testid="ids">{selection.ids.join(',')}</p>
      <EntrySelect entry={entry} projectName="Website" selection={selection} />
    </>
  )
}

describe('EntrySelect', () => {
  test('renders nothing for the running entry', () => {
    render(<Harness entry={{ ...finished, end_time: null }} />)

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  test('is named with the project and the day, and adds the task and the description when there are some', () => {
    const { rerender } = render(<Harness />)
    expect(screen.getByRole('checkbox', { name: 'Auswählen: Website, Di., 22. Sept.' })).toBeInTheDocument()

    rerender(<Harness entry={{ ...finished, task: 'Fix login', description: 'Konzept' }} />)
    expect(screen.getByRole('checkbox', { name: 'Auswählen: Website, Di., 22. Sept., Fix login: Konzept' })).toBeInTheDocument()

    rerender(<Harness entry={{ ...finished, description: 'Konzept' }} />)
    expect(screen.getByRole('checkbox', { name: 'Auswählen: Website, Di., 22. Sept., Konzept' })).toBeInTheDocument()
  })

  test('selects and unselects the entry by its id', async () => {
    render(<Harness />)

    await userEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByTestId('ids')).toHaveTextContent('4')
    expect(screen.getByRole('checkbox')).toBeChecked()

    await userEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByTestId('ids')).toHaveTextContent('')
  })

  test('says its name in English after a language switch', () => {
    render(<Harness />)

    act(() => switchLocale('en'))

    expect(screen.getByRole('checkbox', { name: 'Select: Website, Tue, Sep 22' })).toBeInTheDocument()
  })

  test('has no accessibility violations', async () => {
    const { container } = render(<Harness />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
