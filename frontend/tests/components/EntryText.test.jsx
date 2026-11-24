import { describe, expect, test } from 'vitest'
import { render, screen } from '../support/render'
import EntryText from '@/components/EntryText'

describe('EntryText', () => {
  test('shows the task in bold before the description', () => {
    render(<EntryText entry={{ task: 'Fix login', description: 'Review' }} empty="nichts" />)

    expect(screen.getByText('Fix login')).toHaveClass('font-semibold')
    expect(screen.getByText('Fix login').parentElement).toHaveTextContent('Fix login · Review')
  })

  test('shows only the part that exists', () => {
    const { container, rerender } = render(<EntryText entry={{ task: 'Fix login', description: null }} empty="nichts" />)
    expect(container).toHaveTextContent('Fix login')
    expect(container).not.toHaveTextContent('·')

    rerender(<EntryText entry={{ task: null, description: 'Review' }} empty="nichts" />)
    expect(container).toHaveTextContent('Review')
    expect(container).not.toHaveTextContent('·')
  })

  test('shows what it is given for an entry without both', () => {
    render(<EntryText entry={{ task: null, description: '' }} empty="nichts" />)

    expect(screen.getByText('nichts')).toBeInTheDocument()
  })
})
