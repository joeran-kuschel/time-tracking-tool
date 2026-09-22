import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '../test/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../test/axe'
import EntriesList from './EntriesList'

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
    expect(headings.map((h) => h.textContent)).toEqual(['Website · 1,50 h gesamt', 'App · 2,00 h gesamt'])
    expect(screen.getByRole('table', { name: /^App/ })).toHaveTextContent('App-Arbeit')
    expect(screen.getByRole('table', { name: /^Website/ })).toHaveTextContent('Konzept')
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
    expect(rows[1]).toHaveTextContent('Mo., 21. Sept.09:00 – 12:303,50 hKonzept')
    expect(rows[2]).toHaveTextContent('Di., 22. Sept.10:02 – läuft0,00 h')
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

  test('deletes an entry after a confirmation', async () => {
    const onDelete = vi.fn().mockResolvedValue({ id: 1 })
    render(<EntriesList entries={entries} projects={projects} onUpdate={vi.fn()} onDelete={onDelete} />)

    await userEvent.click(screen.getByRole('button', { name: /löschen/ }))
    expect(screen.getByRole('group', { name: /Eintrag vom .* löschen\?/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }))

    expect(onDelete).toHaveBeenCalledWith(entries[0])
  })
})
