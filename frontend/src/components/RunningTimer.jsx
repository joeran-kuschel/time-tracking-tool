import { StopIcon } from '@heroicons/react/24/solid'
import { Trans, useLingui } from '@lingui/react/macro'
import { useElapsedTime } from '../hooks/useElapsedTime'

// The running timer in the header, on every page: project, customer, elapsed time and a Stop button.
// The button reads "Stop" and is named "Stop timer", to tell it apart from the Stop button of the timer panel.
function RunningTimer({ entry, onStop }) {
  const { t } = useLingui()
  const elapsedTime = useElapsedTime(entry.start_time)

  return (
    <section
      aria-label={t`Running timer`}
      className="flex min-w-0 items-center gap-3 rounded-full border border-danger-line bg-danger-soft py-1 pl-4 pr-1"
    >
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-danger" />
      <p className="min-w-0 truncate text-sm">
        <span className="font-semibold">{entry.project_name}</span>
        {entry.customer_name && <span className="hidden text-muted sm:inline"> · {entry.customer_name}</span>}
      </p>
      <span className="font-mono text-sm font-medium">{elapsedTime}</span>
      <button
        type="button"
        onClick={onStop}
        className="inline-flex min-h-[2rem] shrink-0 items-center gap-1.5 rounded-full bg-danger px-3.5 text-sm font-semibold text-on-fill hover:bg-danger-dark"
      >
        <StopIcon aria-hidden="true" className="h-3 w-3" />
        <Trans>Stop <span className="sr-only">timer</span></Trans>
      </button>
    </section>
  )
}

export default RunningTimer
