import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useState } from 'react'
import { act, render, screen, within } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import EntryFilters from '@/components/EntryFilters'
import { emptyFilters, openingFilters } from '@/filters'
import { switchLocale } from '@/i18n'

const customers = [{ id: 1, name: 'Muster GmbH' }, { id: 2, name: 'Neu AG' }]
const projects = [{ id: 7, name: 'Website' }, { id: 8, name: 'Wartung' }]

// Holds the filters like the page does
function Harness({ initial = openingFilters(new Date(2026, 8, 23)), onReset = () => {}, onSearch = () => {}, projectList = projects }) {
  const [filters, setFilters] = useState(initial)
  return (
    <EntryFilters
      filters={filters}
      customers={customers}
      projects={projectList}
      onChange={(changes) => setFilters((old) => ({ ...old, ...changes }))}
      onSearch={onSearch}
      onReset={() => { onReset(); setFilters(emptyFilters) }}
    />
  )
}

const toggle = () => screen.getByRole('button', { name: 'Filter' })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 23, 12, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('EntryFilters', () => {
  test('has no accessibility violations, in German and English', async () => {
    const { container } = render(<Harness />)
    expect(await axe(container)).toHaveNoViolations()

    act(() => switchLocale('en'))
    expect(await axe(container)).toHaveNoViolations()
  })

  test('is a named search landmark with a labelled field for every filter', () => {
    render(<Harness />)

    expect(screen.getByRole('search', { name: 'Einträge filtern' })).toBeInTheDocument()
    for (const label of ['In Beschreibungen suchen', 'Kunde', 'Projekt', 'Sortierung', 'Zeitraum', 'Von', 'Bis']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.getByLabelText('In Beschreibungen suchen')).toHaveAttribute('type', 'search')
  })

  test('opens with the current month in the period fields', () => {
    render(<Harness />)

    expect(screen.getByLabelText('Zeitraum')).toHaveValue('thisMonth')
    expect(screen.getByLabelText('Von')).toHaveValue('2026-09-01')
    expect(screen.getByLabelText('Bis')).toHaveValue('2026-09-30')
  })

  test('disables the project until a customer is chosen, and resets it when the customer changes', async () => {
    render(<Harness />)
    expect(screen.getByLabelText('Projekt')).toBeDisabled()

    await userEvent.selectOptions(screen.getByLabelText('Kunde'), 'Muster GmbH')
    expect(screen.getByLabelText('Projekt')).toBeEnabled()
    await userEvent.selectOptions(screen.getByLabelText('Projekt'), 'Website')
    expect(screen.getByLabelText('Projekt')).toHaveValue('7')

    await userEvent.selectOptions(screen.getByLabelText('Kunde'), 'Neu AG')
    expect(screen.getByLabelText('Projekt')).toHaveValue('')

    await userEvent.selectOptions(screen.getByLabelText('Kunde'), 'Alle Kunden')
    expect(screen.getByLabelText('Projekt')).toBeDisabled()
  })

  test('a preset fills the dates, and typing a date switches the period to Custom', async () => {
    render(<Harness />)

    await userEvent.selectOptions(screen.getByLabelText('Zeitraum'), 'Letzte Woche')
    expect(screen.getByLabelText('Von')).toHaveValue('2026-09-14')
    expect(screen.getByLabelText('Bis')).toHaveValue('2026-09-20')

    await userEvent.selectOptions(screen.getByLabelText('Zeitraum'), 'Beliebig')
    expect(screen.getByLabelText('Von')).toHaveValue('')
    expect(screen.getByLabelText('Bis')).toHaveValue('')

    await userEvent.selectOptions(screen.getByLabelText('Zeitraum'), 'Heute')
    await userEvent.clear(screen.getByLabelText('Von'))
    await userEvent.type(screen.getByLabelText('Von'), '2026-09-10')
    expect(screen.getByLabelText('Zeitraum')).toHaveValue('custom')
    expect(screen.getByLabelText('Bis')).toHaveValue('2026-09-23')
  })

  test('choosing Custom keeps the dates', async () => {
    render(<Harness />)

    await userEvent.selectOptions(screen.getByLabelText('Zeitraum'), 'Benutzerdefiniert')

    expect(screen.getByLabelText('Von')).toHaveValue('2026-09-01')
  })

  test('applies the search text on Enter', async () => {
    const onSearch = vi.fn()
    render(<Harness onSearch={onSearch} />)

    await userEvent.type(screen.getByLabelText('In Beschreibungen suchen'), 'Konzept{Enter}')

    expect(onSearch).toHaveBeenCalledTimes(1)
  })

  test('marks a reversed period and links the message to both dates', async () => {
    render(<Harness />)

    await userEvent.clear(screen.getByLabelText('Bis'))
    await userEvent.type(screen.getByLabelText('Bis'), '2026-08-01')

    const message = screen.getByText('Das Enddatum darf nicht vor dem Startdatum liegen.')
    for (const field of [screen.getByLabelText('Von'), screen.getByLabelText('Bis')]) {
      expect(field).toHaveAttribute('aria-invalid', 'true')
      expect(field).toHaveAccessibleDescription(message.textContent)
    }
  })

  test('shows no error for a valid period', () => {
    render(<Harness />)

    expect(screen.queryByText('Das Enddatum darf nicht vor dem Startdatum liegen.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Von')).not.toHaveAttribute('aria-invalid')
  })

  describe('active filters', () => {
    test('shows the month chip and the count when the page opens', () => {
      render(<Harness />)

      expect(screen.getByText('1 Filter aktiv')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Filter entfernen: Zeitraum: Dieser Monat' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Filter zurücksetzen' })).toBeInTheDocument()
    })

    test('says so when no filter is active and offers no reset', () => {
      render(<Harness initial={emptyFilters} />)

      expect(screen.getByText('Keine Filter aktiv')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Filter zurücksetzen' })).not.toBeInTheDocument()
    })

    test('has a chip for every filter, including a custom period and the sort order', () => {
      render(<Harness initial={{ q: ' Konzept ', customerId: '1', projectId: '7', preset: 'custom', from: '2026-09-01', to: '', sort: 'oldest' }} />)

      const chips = within(screen.getByRole('list', { name: 'Aktive Filter' })).getAllByRole('button').map((b) => b.textContent)
      expect(chips).toEqual([
        'Suche: Konzept',
        'Kunde: Muster GmbH',
        'Projekt: Website',
        expect.stringMatching(/^Zeitraum: 01\.09\.2026 – …$/),
        'Sortierung: Älteste zuerst',
      ])
      expect(screen.getByText('5 Filter aktiv')).toBeInTheDocument()
    })

    test('a chip removes only its filter', async () => {
      render(<Harness initial={{ ...emptyFilters, q: 'x', customerId: '1', projectId: '7', preset: 'thisMonth', from: '2026-09-01', to: '2026-09-30', sort: 'oldest' }} />)

      await userEvent.click(screen.getByRole('button', { name: 'Filter entfernen: Zeitraum: Dieser Monat' }))
      expect(screen.getByLabelText('Zeitraum')).toHaveValue('any')
      expect(screen.getByLabelText('Von')).toHaveValue('')
      expect(screen.getByLabelText('Kunde')).toHaveValue('1')

      await userEvent.click(screen.getByRole('button', { name: 'Filter entfernen: Sortierung: Älteste zuerst' }))
      expect(screen.getByLabelText('Sortierung')).toHaveValue('newest')

      await userEvent.click(screen.getByRole('button', { name: 'Filter entfernen: Projekt: Website' }))
      expect(screen.getByLabelText('Projekt')).toHaveValue('')
      expect(screen.getByLabelText('Kunde')).toHaveValue('1')

      await userEvent.click(screen.getByRole('button', { name: 'Filter entfernen: Suche: x' }))
      expect(screen.getByLabelText('In Beschreibungen suchen')).toHaveValue('')
      expect(screen.getByLabelText('Kunde')).toHaveValue('1')
    })

    test('removing the customer chip also clears the project, and focus goes to the toggle', async () => {
      render(<Harness initial={{ ...emptyFilters, customerId: '1', projectId: '7' }} />)

      await userEvent.click(screen.getByRole('button', { name: 'Filter entfernen: Kunde: Muster GmbH' }))

      expect(screen.getByLabelText('Kunde')).toHaveValue('')
      expect(screen.getByLabelText('Projekt')).toHaveValue('')
      expect(toggle()).toHaveFocus()
    })

    test('names the chips in English', async () => {
      switchLocale('en')
      render(<Harness />)

      expect(screen.getByText('1 filter active')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Remove filter: Period: This month' })).toBeInTheDocument()
    })
  })

  describe('Reset', () => {
    test('clears every filter, including the period and the sort order, and focuses the search field', async () => {
      const onReset = vi.fn()
      render(<Harness onReset={onReset} initial={{ ...openingFilters(new Date(2026, 8, 23)), q: 'x', customerId: '1', projectId: '7', sort: 'oldest' }} />)

      await userEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }))

      expect(onReset).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('In Beschreibungen suchen')).toHaveValue('')
      expect(screen.getByLabelText('Kunde')).toHaveValue('')
      expect(screen.getByLabelText('Zeitraum')).toHaveValue('any')
      expect(screen.getByLabelText('Von')).toHaveValue('')
      expect(screen.getByLabelText('Sortierung')).toHaveValue('newest')
      expect(screen.getByText('Keine Filter aktiv')).toBeInTheDocument()
      expect(screen.getByLabelText('In Beschreibungen suchen')).toHaveFocus()
    })

    test('focuses the toggle when the section is collapsed', async () => {
      render(<Harness />)
      await userEvent.click(toggle())

      await userEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }))

      expect(toggle()).toHaveFocus()
      expect(screen.getByText('Keine Filter aktiv')).toBeInTheDocument()
    })
  })

  describe('collapsing', () => {
    test('is expanded at first, and the toggle controls the fields', () => {
      render(<Harness />)

      expect(toggle()).toHaveAttribute('aria-expanded', 'true')
      const panel = document.getElementById(toggle().getAttribute('aria-controls'))
      expect(panel).toContainElement(screen.getByLabelText('Kunde'))
      expect(panel).toBeVisible()
    })

    test('is a button inside a heading', () => {
      render(<Harness />)

      expect(screen.getByRole('heading', { level: 2, name: 'Filter' })).toContainElement(toggle())
    })

    test('hides the fields when collapsed and shows them again, with focus staying on the toggle', async () => {
      render(<Harness />)

      await userEvent.click(toggle())
      expect(toggle()).toHaveAttribute('aria-expanded', 'false')
      expect(toggle()).toHaveFocus()
      expect(screen.getByLabelText('Kunde')).not.toBeVisible()
      expect(document.getElementById(toggle().getAttribute('aria-controls'))).not.toBeVisible()

      await userEvent.click(toggle())
      expect(toggle()).toHaveAttribute('aria-expanded', 'true')
      expect(toggle()).toHaveFocus()
      expect(screen.getByLabelText('Kunde')).toBeVisible()
    })

    test('works with Enter and Space', async () => {
      render(<Harness />)
      toggle().focus()

      await userEvent.keyboard('{Enter}')
      expect(toggle()).toHaveAttribute('aria-expanded', 'false')
      await userEvent.keyboard(' ')
      expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    })

    test('keeps the search landmark, its name, the chips and Reset reachable when collapsed', async () => {
      render(<Harness initial={{ ...openingFilters(new Date(2026, 8, 23)), q: 'x' }} />)
      await userEvent.click(toggle())

      expect(screen.getByRole('search', { name: 'Einträge filtern' })).toBeInTheDocument()
      expect(screen.getByText('2 Filter aktiv')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Filter entfernen: Suche: x' })).toBeVisible()
      expect(screen.getByRole('button', { name: 'Filter zurücksetzen' })).toBeVisible()
    })

    test('a chip still removes its filter when collapsed', async () => {
      render(<Harness />)
      await userEvent.click(toggle())

      await userEvent.click(screen.getByRole('button', { name: 'Filter entfernen: Zeitraum: Dieser Monat' }))

      expect(screen.getByText('Keine Filter aktiv')).toBeInTheDocument()
      expect(toggle()).toHaveFocus()
    })

    test('has no accessibility violations when collapsed', async () => {
      const { container } = render(<Harness />)
      await userEvent.click(toggle())

      expect(await axe(container)).toHaveNoViolations()
    })
  })
})
