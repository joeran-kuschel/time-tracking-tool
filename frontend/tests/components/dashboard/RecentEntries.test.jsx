import { describe, expect, test, vi } from 'vitest'
import { renderWithRouter as render, screen, within } from '../../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../../support/axe'
import RecentEntries from '@/components/dashboard/RecentEntries'

const entries = [
  { id: 1, customer_id: 1, customer_name: 'Muster GmbH', project_id: 7, project_name: 'Website', description: 'Login', start_time: '2026-09-21T08:00:00Z', end_time: '2026-09-21T09:30:00Z' },
  { id: 2, customer_id: 2, customer_name: 'Berger', project_id: 8, project_name: 'Pflege', description: null, start_time: '2026-09-20T08:00:00Z', end_time: '2026-09-20T09:00:00Z' },
]
const resume = (props = {}) => ({ onResume: vi.fn(), timerRunning: false, busy: false, ...props })

describe('RecentEntries', () => {
  test('without resume, shows links and no buttons or hints', () => {
    render(<RecentEntries entries={entries} />)

    expect(screen.getAllByRole('link', { name: /Muster|Berger|Alle/ })).toHaveLength(3)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  test('with resume, has one button per entry beside its link, which still opens the project', () => {
    render(<RecentEntries entries={entries} resume={resume()} />)

    const first = within(screen.getAllByRole('listitem')[0])
    expect(first.getByRole('button', { name: 'Fortsetzen: Website, Login' })).toBeInTheDocument()
    expect(first.getByRole('link')).toHaveAttribute('href', '/time-tracking/1/7')
    expect(screen.getByRole('button', { name: 'Fortsetzen: Pflege' })).toBeInTheDocument()
  })

  test('clicking the button resumes that entry and is not a click on the link', async () => {
    const options = resume()
    render(<RecentEntries entries={entries} resume={options} />)

    await userEvent.click(screen.getByRole('button', { name: 'Fortsetzen: Pflege' }))

    expect(options.onResume).toHaveBeenCalledWith(entries[1])
    expect(options.onResume).toHaveBeenCalledTimes(1)
  })

  test('renders the hints once, not once per entry', () => {
    render(<RecentEntries entries={entries} resume={resume()} />)

    expect(document.querySelectorAll('#resume-hint-break')).toHaveLength(1)
  })

  test('with an empty list, shows the empty text and no View all link', () => {
    render(<RecentEntries entries={[]} resume={resume()} />)

    expect(screen.getByText('Noch keine Einträge.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Alle ansehen' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  test('has no accessibility violations with resume buttons', async () => {
    const { container } = render(<RecentEntries entries={entries} resume={resume({ timerRunning: true })} />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
