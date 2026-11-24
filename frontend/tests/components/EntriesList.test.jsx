import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import EntriesList from '@/components/EntriesList'

const entries = [
  { id: 1, project_id: 7, start_time: '2026-09-21T08:00:00Z', end_time: '2026-09-21T09:30:00Z', description: 'Konzept' },
  { id: 2, project_id: 7, start_time: '2026-09-21T10:00:00Z', end_time: null, description: null },
]

const projects = [{ id: 7, name: 'Website' }]

describe('EntriesList', () => {
  test('groups entries by project in the order of the projects, with total hours, and leaves out empty projects', () => {
    const grouped = [
      { id: 3, project_id: 8, start_time: '2026-09-21T08:00:00Z', end_time: '2026-09-21T10:00:00Z', description: 'App-Arbeit' },
      ...entries,
    ]
    render(<EntriesList entries={grouped} projects={[{ id: 9, name: 'Leer' }, ...projects, { id: 8, name: 'App' }]} />)

    const headings = screen.getAllByRole('heading', { level: 3 })
    expect(headings.map((h) => h.textContent)).toEqual(['Website · 1:30 h gesamt', 'App · 2:00 h gesamt'])
    expect(screen.getByRole('table', { name: /^App/ })).toHaveTextContent('App-Arbeit')
    expect(screen.getByRole('table', { name: /^Website/ })).toHaveTextContent('Konzept')
  })

  test('the rows of a project add up to its total: whole minutes each, not rounded in the end', () => {
    // three entries of 20 s (0 minutes) and two of 40 s (1 minute): 2 minutes, not the 3 of the exact sum 200 s
    const at = (id, end) => ({ id, project_id: 7, start_time: '2026-09-21T08:00:00Z', end_time: end, description: null })
    const short = [at(1, '2026-09-21T08:00:20Z'), at(2, '2026-09-21T08:00:20Z'), at(3, '2026-09-21T08:00:20Z'), at(4, '2026-09-21T08:00:40Z'), at(5, '2026-09-21T08:00:40Z')]
    render(<EntriesList entries={short} projects={projects} />)

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Website · 0:02 h gesamt')
  })

  test('shows the task before the description', () => {
    const withTask = [{ ...entries[0], task: 'Fix login' }]
    render(<EntriesList entries={withTask} projects={projects} />)

    expect(screen.getByRole('table', { name: /^Website/ })).toHaveTextContent('Fix login · Konzept')
  })

  test('shows the duration of an entry as a time element', () => {
    render(<EntriesList entries={entries} projects={projects} />)

    expect(screen.getAllByRole('row')[1].querySelector('time')).toHaveAttribute('datetime', 'PT1H30M')
  })

  test('shows an empty state without entries', () => {
    render(<EntriesList entries={[]} projects={[]} />)
    expect(screen.getByText('Noch keine Einträge')).toBeInTheDocument()
  })

  test('shows day, start and end time and hours, and marks running entries', () => {
    const local = [
      { id: 1, project_id: 7, start_time: new Date(2026, 8, 21, 9, 0).toISOString(), end_time: new Date(2026, 8, 21, 12, 30).toISOString(), description: 'Konzept' },
      { id: 2, project_id: 7, start_time: new Date(2026, 8, 22, 10, 2).toISOString(), end_time: null, description: null },
    ]
    render(<EntriesList entries={local} projects={projects} />)

    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Mo., 21. Sept.09:00 – 12:303:30 hKonzept')
    expect(rows[2]).toHaveTextContent('Di., 22. Sept.10:02 – läuft0:00 h')
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = render(<EntriesList entries={entries} projects={[...projects, { id: 8, name: 'App' }]} />)
    expect(await axe(container)).toHaveNoViolations()
  })

  test('only finished entries can be edited or deleted', () => {
    render(<EntriesList entries={entries} projects={projects} />)
    expect(screen.getAllByRole('button', { name: /bearbeiten/ })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: /löschen/ })).toHaveLength(1)
  })

  test('edits an entry in place', async () => {
    const onUpdate = vi.fn().mockResolvedValue({ id: 1 })
    render(<EntriesList entries={entries} projects={projects} onUpdate={onUpdate} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /bearbeiten/ }))
    expect(screen.getByLabelText('Projekt')).toHaveFocus()
    await userEvent.clear(screen.getByLabelText('Beschreibung (optional)'))
    await userEvent.type(screen.getByLabelText('Beschreibung (optional)'), 'Konzept überarbeitet')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(onUpdate).toHaveBeenCalledWith(entries[0], expect.objectContaining({ projectId: 7, description: 'Konzept überarbeitet' }))
  })

  test('the edit form offers the earlier tasks of the entry\'s project, each once, and not those of other projects', async () => {
    const list = [
      { id: 1, project_id: 7, start_time: '2026-09-21T08:00:00Z', end_time: '2026-09-21T09:30:00Z', description: null, task: 'Fix login' },
      { id: 2, project_id: 7, start_time: '2026-09-22T08:00:00Z', end_time: '2026-09-22T09:30:00Z', description: null, task: 'fix LOGIN' },
      { id: 3, project_id: 7, start_time: '2026-09-23T08:00:00Z', end_time: '2026-09-23T09:30:00Z', description: null, task: 'Review' },
      { id: 4, project_id: 8, start_time: '2026-09-23T08:00:00Z', end_time: '2026-09-23T09:30:00Z', description: null, task: 'Elsewhere' },
    ]
    render(<EntriesList entries={list} projects={[...projects, { id: 8, name: 'App' }]} onUpdate={vi.fn()} onDelete={vi.fn()} />)

    await userEvent.click(screen.getAllByRole('button', { name: /bearbeiten/ })[0])

    const options = [...screen.getByLabelText('Aufgabe (optional)').list.options].map((option) => option.value)
    expect(options).toEqual(['Review', 'fix LOGIN'])
  })

  test('changing the task of an entry sends it with the save', async () => {
    const onUpdate = vi.fn().mockResolvedValue({ id: 1 })
    render(<EntriesList entries={[{ ...entries[0], task: 'Fix login' }]} projects={projects} onUpdate={onUpdate} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /bearbeiten/ }))
    await userEvent.clear(screen.getByLabelText('Aufgabe (optional)'))
    await userEvent.type(screen.getByLabelText('Aufgabe (optional)'), 'Review')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), expect.objectContaining({ task: 'Review' }))
  })

  test('deletes an entry after a confirmation', async () => {
    const onDelete = vi.fn().mockResolvedValue({ id: 1 })
    render(<EntriesList entries={entries} projects={projects} onUpdate={vi.fn()} onDelete={onDelete} />)

    await userEvent.click(screen.getByRole('button', { name: /löschen/ }))
    expect(screen.getByRole('group', { name: /Eintrag vom .* löschen\?/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }))

    expect(onDelete).toHaveBeenCalledWith(entries[0])
  })

  describe('Resume', () => {
    const finished = [entries[0]]

    test('has a button with the project and description in its name, only on finished entries', () => {
      render(<EntriesList entries={entries} projects={projects} resume={{ onResume: vi.fn() }} />)

      expect(screen.getAllByRole('button', { name: /Fortsetzen/ })).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'Fortsetzen: Website, Konzept' })).toBeInTheDocument()
    })

    test('names only the project for an entry without description', () => {
      const bare = [{ ...entries[0], description: null }]
      render(<EntriesList entries={bare} projects={projects} resume={{ onResume: vi.fn() }} />)

      expect(screen.getByRole('button', { name: 'Fortsetzen: Website' })).toBeInTheDocument()
    })

    test('has no buttons without onResume', () => {
      render(<EntriesList entries={finished} projects={projects} />)

      expect(screen.queryByRole('button', { name: /Fortsetzen/ })).not.toBeInTheDocument()
    })

    test('calls onResume with the entry, also by keyboard', async () => {
      const onResume = vi.fn()
      render(<EntriesList entries={finished} projects={projects} resume={{ onResume }} />)

      screen.getByRole('button', { name: /Fortsetzen/ }).focus()
      await userEvent.keyboard('{Enter}')

      expect(onResume).toHaveBeenCalledWith(finished[0])
    })

    test('says that the time since the end of the entry counts as work time', () => {
      render(<EntriesList entries={finished} projects={projects} resume={{ onResume: vi.fn() }} />)

      expect(screen.getByRole('button', { name: /Fortsetzen/ })).toHaveAccessibleDescription(
        'Der Eintrag läuft weiter: die Zeit seit seinem Ende zählt als Arbeitszeit.'
      )
    })

    test('with a running timer, does nothing and says why', async () => {
      const onResume = vi.fn()
      render(<EntriesList entries={finished} projects={projects} resume={{ onResume, timerRunning: true }} />)

      const button = screen.getByRole('button', { name: /Fortsetzen/ })
      await userEvent.click(button)

      expect(button).toHaveAttribute('aria-disabled', 'true')
      expect(button).toHaveAccessibleDescription('Stoppe zuerst den laufenden Timer.')
      expect(onResume).not.toHaveBeenCalled()
    })

    test('while a start is being sent, does nothing', async () => {
      const onResume = vi.fn()
      render(<EntriesList entries={finished} projects={projects} resume={{ onResume, busy: true }} />)

      await userEvent.click(screen.getByRole('button', { name: /Fortsetzen/ }))

      expect(onResume).not.toHaveBeenCalled()
    })

    test('has no accessibility violations', async () => {
      const { container } = render(<EntriesList entries={entries} projects={projects} resume={{ onResume: vi.fn(), timerRunning: true }} />)

      expect(await axe(container)).toHaveNoViolations()
    })
  })
})
