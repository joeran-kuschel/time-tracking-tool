import { Link } from 'react-router'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { trackingPath } from '../../routes'
import { link } from './table'

// What the backend's preview says is still missing (its `missing` codes), each with where to put it right.
// settings: your details are in the settings; customer: the customer's address is in its form on Time tracking.
const reasons = {
  senderName: { text: msg`Your name is missing.`, to: 'settings' },
  senderAddress: { text: msg`Your address is missing.`, to: 'settings' },
  senderTaxId: { text: msg`Your tax ID is missing.`, to: 'settings' },
  customerAddress: { text: msg`The customer has no address.`, to: 'customer' },
  noEntries: { text: msg`There are no entries to bill in this period.`, to: null },
}

function MissingDetails({ missing, customerId }) {
  const { i18n } = useLingui()
  return (
    <div role="alert" className="rounded-lg border border-danger-line bg-danger-soft p-4">
      <p className="font-medium text-ink"><Trans>This invoice cannot be created yet:</Trans></p>
      <ul className="mt-1 list-disc pl-5 text-sm">
        {missing.map((code) => {
          const reason = reasons[code]
          if (!reason) return null
          return (
            <li key={code}>
              {i18n._(reason.text)}
              {reason.to === 'settings' && <> <Link to="/settings" className={link}><Trans>Open Settings</Trans></Link></>}
              {reason.to === 'customer' && <> <Link to={trackingPath(customerId)} className={link}><Trans>Open customer</Trans></Link></>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default MissingDetails
