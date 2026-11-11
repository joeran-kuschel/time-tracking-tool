import { describe, expect, test } from 'vitest'
import { render, screen } from '../support/render'
import { axe } from '../support/axe'
import { i18n } from '@/i18n'
import RoundingNote from '@/components/RoundingNote'

describe('RoundingNote', () => {
  test.each([
    [{ minutes: 15, direction: 'up' }, 'Stunden auf Viertelstunden aufgerundet.'],
    [{ minutes: 30, direction: 'up' }, 'Stunden auf halbe Stunden aufgerundet.'],
    [{ minutes: 15, direction: 'nearest' }, 'Stunden auf die nächstgelegene Viertelstunde gerundet.'],
    [{ minutes: 30, direction: 'nearest' }, 'Stunden auf die nächstgelegene halbe Stunde gerundet.'],
  ])('names the rule %j in German', (rounding, sentence) => {
    render(<RoundingNote rounding={rounding} />)

    expect(screen.getByText(sentence)).toBeInTheDocument()
  })

  test('names the rule in English', () => {
    i18n.activate('en')
    render(<RoundingNote rounding={{ minutes: 15, direction: 'nearest' }} />)

    expect(screen.getByText('Hours rounded to the nearest quarter hour.')).toBeInTheDocument()
  })

  test.each([[null], [undefined], [{}]])('shows nothing for %j', (rounding) => {
    const { container } = render(<RoundingNote rounding={rounding} />)

    expect(container).toBeEmptyDOMElement()
  })

  test('takes its own class', () => {
    render(<RoundingNote rounding={{ minutes: 15, direction: 'up' }} className="mt-4" />)

    expect(screen.getByText('Stunden auf Viertelstunden aufgerundet.')).toHaveClass('mt-4')
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = render(<RoundingNote rounding={{ minutes: 30, direction: 'up' }} />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
