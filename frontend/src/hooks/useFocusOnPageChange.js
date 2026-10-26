import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

// Moves focus to the new page's <h1> (or to the container when it has none) when the first part of the address
// changes, so screen reader and keyboard users land on the new page. Not on the first render, and not when only
// the query or a selection further down the path changes.
// container: ref of the element that holds the page, with tabIndex={-1}
export function useFocusOnPageChange(container) {
  const page = useLocation().pathname.split('/')[1].toLowerCase()
  const previous = useRef(page)

  useEffect(() => {
    if (previous.current === page) return
    previous.current = page
    const root = container.current
    const heading = root?.querySelector('h1')
    if (heading) {
      heading.tabIndex = -1
      heading.classList.add('focus:outline-none')
      heading.focus()
    } else {
      root?.focus()
    }
  }, [page, container])
}
