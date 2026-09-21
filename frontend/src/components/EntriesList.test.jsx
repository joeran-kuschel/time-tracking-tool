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
  test('shows an empty state without entries', () => {
    render(<EntriesList entries={[]} projects={[]} />)
    expect(screen.getByText('Noch keine Einträge')).toBeInTheDocument()
  })

  test('shows hours for finished entries and marks running ones', () => {
    render(<EntriesList entries={entries} projects={projects} />)
    expect(screen.getByText('1,50 h')).toBeInTheDocument()
    expect(screen.getByText('Aktiv')).toBeInTheDocument()
    expect(screen.getByText('Konzept')).toBeInTheDocument()
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = render(<EntriesList entries={entries} projects={projects} />)
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
