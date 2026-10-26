import { Link } from 'react-router'
import { Trans } from '@lingui/react/macro'
import { ui } from '../ui'

// Shown for every address that is not a page
function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-4 p-4 sm:p-8">
      <h1 className="font-serif text-4xl font-semibold leading-tight"><Trans>Page not found</Trans></h1>
      <p className="text-muted"><Trans>There is no page at this address.</Trans></p>
      <Link to="/" className={ui.buttonPrimary}><Trans>Go to the Dashboard</Trans></Link>
    </div>
  )
}

export default NotFound
