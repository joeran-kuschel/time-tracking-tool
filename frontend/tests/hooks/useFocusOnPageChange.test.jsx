import { StrictMode, useRef } from 'react'
import { describe, expect, test } from 'vitest'
import userEvent from '@testing-library/user-event'
import { useLocation, useNavigate } from 'react-router'
import { renderWithRouter, screen } from '../support/render'
import { useFocusOnPageChange } from '@/hooks/useFocusOnPageChange'
import { usePageTitle } from '@/hooks/usePageTitle'

// A page container like App's <main>; `withHeading` says whether the page has an <h1>
function Harness({ withHeading = true }) {
  const main = useRef(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useFocusOnPageChange(main)
  return (
    <>
      {['/a', '/a/', '/a/1', '/a?x=1', '/a#top', '/B', '/b'].map((to) => (
        <button key={to} onClick={() => navigate(to)}>{`go ${to}`}</button>
      ))}
      <main ref={main} tabIndex={-1}>
        {withHeading && <h1>{`Heading ${pathname}`}</h1>}
        <p>content</p>
      </main>
    </>
  )
}

const go = (to) => userEvent.click(screen.getByRole('button', { name: `go ${to}` }))

describe('useFocusOnPageChange', () => {
  test('does not move focus on the first render, also in StrictMode with its doubled effects', () => {
    renderWithRouter(<StrictMode><Harness /></StrictMode>, { route: '/a' })

    expect(document.body).toHaveFocus()
  })

  test('focuses the heading when the first path segment changes', async () => {
    renderWithRouter(<Harness />, { route: '/' })

    await go('/a')

    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  })

  test('focuses the container when the page has no heading', async () => {
    renderWithRouter(<Harness withHeading={false} />, { route: '/' })

    await go('/a')

    expect(screen.getByRole('main')).toHaveFocus()
  })

  test.each(['/a/', '/a/1', '/a?x=1', '/a#top'])('keeps focus where it is when only %s differs from the open page', async (to) => {
    renderWithRouter(<Harness />, { route: '/a' })
    const button = screen.getByRole('button', { name: `go ${to}` })
    await userEvent.click(button)

    expect(button).toHaveFocus()
  })

  test('ignores the case of the first segment', async () => {
    renderWithRouter(<Harness />, { route: '/b' })
    const button = screen.getByRole('button', { name: 'go /B' })
    await userEvent.click(button)

    expect(button).toHaveFocus()
  })

  test('focuses again after leaving and coming back', async () => {
    renderWithRouter(<Harness />, { route: '/a' })
    await go('/b')
    await go('/a')

    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  })
})

describe('usePageTitle', () => {
  function Title({ title }) {
    usePageTitle(title)
    return null
  }

  test('sets the title with the app name and updates it', () => {
    const { rerender } = renderWithRouter(<Title title="Reports" />)
    expect(document.title).toBe('Reports · Time Tracking')

    rerender(<Title title="Berichte" />)
    expect(document.title).toBe('Berichte · Time Tracking')
  })
})
