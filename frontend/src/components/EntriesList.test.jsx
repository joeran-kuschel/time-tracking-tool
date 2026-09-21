import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from '../test/axe'
import EntriesList from './EntriesList'

const entries = [
  { id: 1, start_time: '2026-09-21T08:00:00Z', end_time: '2026-09-21T09:30:00Z', description: 'Konzept' },
  { id: 2, start_time: '2026-09-21T10:00:00Z', end_time: null, description: null },
]

describe('EntriesList', () => {
  test('shows an empty state without entries', () => {
    render(<EntriesList entries={[]} />)
    expect(screen.getByText('Noch keine Einträge')).toBeInTheDocument()
  })

  test('shows hours for finished entries and marks running ones', () => {
    render(<EntriesList entries={entries} />)
    expect(screen.getByText('1.50h')).toBeInTheDocument()
    expect(screen.getByText('Aktiv')).toBeInTheDocument()
    expect(screen.getByText('Konzept')).toBeInTheDocument()
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = render(<EntriesList entries={entries} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
