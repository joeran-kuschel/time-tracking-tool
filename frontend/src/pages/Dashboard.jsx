import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { DocumentTextIcon } from '@heroicons/react/24/outline'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '../api'
import { useAction } from '../hooks/useAction'
import { byCustomer, dashboardRange, monthEntries } from '../dashboard'
import ErrorMessage from '../components/ErrorMessage'
import TrackTimeCard from '../components/dashboard/TrackTimeCard'
import KeyFigures from '../components/dashboard/KeyFigures'
import HoursChart from '../components/dashboard/HoursChart'
import ByCustomer from '../components/dashboard/ByCustomer'
import BillingTable from '../components/dashboard/BillingTable'
import RecentEntries from '../components/dashboard/RecentEntries'
import { reportPath } from '../routes'
import { ui } from '../ui'

// The start page: track time, the month's figures, chart and billing, and the latest entries.
// Everything comes from one request (GET /api/dashboard); the sums are calculated here (dashboard.js).
// Its links open the Time tracking page for a customer and project and the Reports page.
function Dashboard({ timer }) {
  const [data, setData] = useState(null)
  const [run, error] = useAction()
  const { i18n } = useLingui()
  const [now] = useState(() => new Date())

  const load = async () => {
    const { from, to } = dashboardRange(now)
    const result = await run(
      () => api.getDashboard(from.toISOString(), to.toISOString(), now.getMonth() + 1, now.getFullYear()),
      msg`Dashboard could not be loaded.`
    )
    if (result) setData(result)
  }

  useEffect(() => {
    load()
  }, [])

  // A timer started or stopped elsewhere (the header) changes the figures too
  const activeId = timer.activeEntry?.id
  const previousActiveId = useRef(activeId)
  useEffect(() => {
    if (previousActiveId.current === activeId) return
    previousActiveId.current = activeId
    load()
  }, [activeId])

  const today = i18n.date(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const customers = data ? byCustomer(monthEntries(data.entries, now)) : []

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{today}</p>
          <h1 className="font-serif text-4xl font-semibold leading-tight"><Trans>Dashboard</Trans></h1>
        </div>
        <Link to={reportPath()} className={`${ui.buttonSecondary} min-h-[2.75rem]`}>
          <DocumentTextIcon aria-hidden="true" className="h-5 w-5" />
          <Trans>Monthly reports</Trans>
        </Link>
      </div>

      {error && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-danger-line bg-danger-soft p-4">
          <ErrorMessage message={error} />
          <button type="button" onClick={load} className={ui.buttonPrimary}><Trans>Try again</Trans></button>
        </div>
      )}
      {!data && !error && <p className="text-muted"><Trans>Loading...</Trans></p>}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
            <TrackTimeCard
              projects={data.projects}
              defaultProjectId={data.recent[0]?.project_id}
              timer={timer}
              onSaved={load}
            />
            <KeyFigures entries={data.entries} lastMonthReports={data.lastMonthReports} now={now} />
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
            <HoursChart entries={data.entries} now={now} />
            <ByCustomer rows={customers} now={now} />
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
            <BillingTable
              rows={customers}
              now={now}
              lastMonthReports={data.lastMonthReports}
            />
            <RecentEntries entries={data.recent} />
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard
