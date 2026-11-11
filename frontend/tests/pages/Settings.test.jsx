import { describe, expect, test } from 'vitest'
import { render } from '../support/render'
import { axe } from '../support/axe'
import Settings from '@/pages/Settings'

describe('Settings', () => {
  test('has a heading and says there are no options yet', () => {
    render(<Settings />)

    expect(document.querySelector('h1')).toHaveTextContent('Einstellungen')
    expect(document.body).toHaveTextContent('Es gibt noch keine Optionen.')
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = render(<Settings />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
