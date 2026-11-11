import { Trans } from '@lingui/react/macro'

// App-wide options. There are none yet; the first one (rounding of tracked time) adds a form here that loads and
// saves through api.getSettings / api.updateSettings.
function Settings() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-8">
      <h1 className="font-serif text-4xl font-semibold leading-tight"><Trans>Settings</Trans></h1>
      <p className="text-muted"><Trans>There are no options yet.</Trans></p>
    </div>
  )
}

export default Settings
