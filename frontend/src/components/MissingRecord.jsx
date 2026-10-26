import { Link } from 'react-router'

// For an address that names a record that does not exist (any more): the message and a way out.
// `message` and `linkText` are translated texts, `to` is where the link goes. The link leaves with the message, so
// focus moves to the page's heading first (the address stays on the same page, which the page-change hook ignores).
function MissingRecord({ message, to, linkText }) {
  const focusHeading = (event) => {
    const heading = event.currentTarget.closest('main')?.querySelector('h1')
    if (!heading) return
    heading.tabIndex = -1
    heading.focus()
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-danger-line bg-danger-soft p-4">
      <p role="alert" className="text-sm text-danger">{message}</p>
      <Link to={to} onClick={focusHeading} className="inline-flex min-h-[2.75rem] items-center text-sm font-medium text-accent underline underline-offset-2 hover:text-accent-dark">
        {linkText}
      </Link>
    </div>
  )
}

export default MissingRecord
