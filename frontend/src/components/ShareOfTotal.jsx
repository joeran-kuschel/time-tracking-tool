import { Trans, useLingui } from '@lingui/react/macro'
import { formatShare } from '../format'

// Visually hidden "42 % of total" for a bar that is hidden from screen readers; put it right after the hours.
function ShareOfTotal({ hours, total }) {
  const { i18n } = useLingui()
  const share = formatShare(i18n, hours, total)
  return <span className="sr-only"><Trans>, {share} of total</Trans></span>
}

export default ShareOfTotal
