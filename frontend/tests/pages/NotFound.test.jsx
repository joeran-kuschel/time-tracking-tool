import { describe, expect, test } from 'vitest'
import { renderWithRouter, screen } from '../support/render'
import { axe } from '../support/axe'
import NotFound from '@/pages/NotFound'

describe('NotFound', () => {
  test('says there is no page and links to the Dashboard', () => {
    renderWithRouter(<NotFound />, { route: '/nope' })

    expect(screen.getByRole('heading', { level: 1, name: 'Seite nicht gefunden' })).toBeInTheDocument()
    expect(screen.getByText('Unter dieser Adresse gibt es keine Seite.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zum Dashboard' })).toHaveAttribute('href', '/')
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = renderWithRouter(<NotFound />, { route: '/nope' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
