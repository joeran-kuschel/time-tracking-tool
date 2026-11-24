import { describe, expect, test, vi } from 'vitest'
import { renderWithRouter as render, screen, within } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import EntryResults from '@/components/EntryResults'
import { useSelection } from '@/hooks/useSelection'

const entry = (id, extra = {}) => ({
  id, customer_id: 1, customer_name: 'Muster GmbH', project_id: 7, project_name: 'Website', description: `Eintrag ${id}`,
  start_time: '2026-09-21T08:00:00Z', end_time: '2026-09-21T09:30:00Z', ...extra,
})
const results = (entries) => ({ entries, total: entries.length, hours: entries.length * 1.5 })
const resume = (props = {}) => ({ onResume: vi.fn(), timerRunning: false, busy: false, ...props })
const renderResults = (props) => render(<EntryResults results={results([entry(1), entry(2, { end_time: null })])} onShowMore={vi.fn()} {...props} />)

describe('EntryResults', () => {
  test('without resume, has no Resume buttons', () => {
    renderResults()

    expect(screen.queryByRole('button', { name: /Fortsetzen/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Öffnen/ })).toHaveLength(2)
  })

  test('shows the task in bold before the description, and the description alone without a task', () => {
    render(<EntryResults results={results([entry(1, { task: 'Fix login' }), entry(2)])} onShowMore={vi.fn()} />)

    const [withTask, without] = screen.getAllByRole('row').slice(1)
    expect(withTask).toHaveTextContent('Fix login · Eintrag 1')
    expect(without).toHaveTextContent('Eintrag 2')
    expect(without).not.toHaveTextContent('·  ·')
  })

  test('an entry with a task and no description shows the task only', () => {
    render(<EntryResults results={results([entry(1, { task: 'Fix login', description: null })])} onShowMore={vi.fn()} />)

    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Fix login')
    expect(screen.queryByText('Keine Beschreibung')).not.toBeInTheDocument()
  })

  test('puts the Resume button before Open in the row of a finished entry only', () => {
    renderResults({ resume: resume() })

    const [finished, running] = screen.getAllByRole('row').slice(1)
    const buttons = within(finished).getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].compareDocumentPosition(within(finished).getByRole('link')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(running).queryByRole('button')).not.toBeInTheDocument()
  })

  test('resumes the entry of the clicked row', async () => {
    const options = resume()
    renderResults({ resume: options, results: results([entry(1), entry(3)]) })

    await userEvent.click(screen.getByRole('button', { name: 'Fortsetzen: Website, Eintrag 3' }))

    expect(options.onResume).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }))
  })

  test('with a start or stop being sent, does nothing', async () => {
    const options = resume({ busy: true })
    renderResults({ resume: options })

    await userEvent.click(screen.getByRole('button', { name: /Fortsetzen/ }))

    expect(options.onResume).not.toHaveBeenCalled()
  })

  test('without entries, shows the status and no buttons', () => {
    render(<EntryResults results={results([])} onShowMore={vi.fn()} resume={resume()} />)

    expect(screen.getByRole('status')).toHaveTextContent('Keine Einträge gefunden')
    expect(screen.queryByRole('button', { name: /Fortsetzen/ })).not.toBeInTheDocument()
  })

  test('has no accessibility violations with resume buttons', async () => {
    const { container } = renderResults({ resume: resume({ timerRunning: true }) })

    expect(await axe(container)).toHaveNoViolations()
  })
})

function WithSelection({ list }) {
  const selection = useSelection()
  return (
    <>
      <p data-testid="ids">{selection.ids.join(',')}</p>
      <EntryResults results={results(list)} onShowMore={vi.fn()} selection={selection} />
    </>
  )
}

describe('EntryResults with a selection', () => {
  const list = [entry(1), entry(2, { end_time: null }), entry(3)]

  test('has no checkboxes without a selection', () => {
    renderResults()

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  test('has a checkbox for each finished result, none for a running one, and one in the header for all shown', () => {
    render(<WithSelection list={list} />)

    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(3)
    expect(boxes[0]).toHaveAccessibleName('Alle angezeigten auswählen')
    expect(boxes[1].getAttribute('aria-label')).toMatch(/^Auswählen: Website, .*, Eintrag 1$/)
  })

  test('selects one result, and all shown with the header checkbox (mixed in between)', async () => {
    render(<WithSelection list={list} />)
    const all = () => screen.getByRole('checkbox', { name: 'Alle angezeigten auswählen' })

    await userEvent.click(screen.getAllByRole('checkbox')[1])
    expect(screen.getByTestId('ids')).toHaveTextContent('1')
    expect(all().indeterminate).toBe(true)

    await userEvent.click(all())
    expect(screen.getByTestId('ids')).toHaveTextContent('1,3')
    expect(all()).toBeChecked()

    await userEvent.click(all())
    expect(screen.getByTestId('ids')).toHaveTextContent('')
  })

  test('has no header checkbox when only a running entry is shown', () => {
    render(<WithSelection list={[entry(2, { end_time: null })]} />)

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  test('has no accessibility violations', async () => {
    const { container } = render(<WithSelection list={list} />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
