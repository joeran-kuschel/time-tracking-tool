import { useId, useState } from 'react'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '../../api'
import { useAction } from '../../hooks/useAction'
import { formatHours, hoursBetween } from '../../format'
import { ui } from '../../ui'
import EntryForm from '../EntryForm'
import Tabs from '../Tabs'
import Timer from '../Timer'

const label = (project) => `${project.customer_name} · ${project.name}`

// Track time from the dashboard: the running timer (shared with the header via App's timer),
// or a manual entry. projects: all projects with customer_name; defaultProjectId preselects one.
// onSaved runs after a manual entry was saved, so the dashboard can reload (it reloads by itself when the timer stops).
function TrackTimeCard({ projects, defaultProjectId, timer, onSaved }) {
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? null)
  const [saved, setSaved] = useState(null)
  const [runAdd, addError] = useAction()
  const { t, i18n } = useLingui()
  const headingId = useId()
  const selectId = useId()

  const project = projects.find((p) => p.id === projectId) ?? null
  const customer = project && { id: project.customer_id, name: project.customer_name }

  const start = async (description) => {
    setSaved(null)
    return timer.start(project, description, customer)
  }

  const stop = async () => {
    const running = timer.activeEntry
    const stopped = await timer.stop()
    if (stopped) {
      setSaved({ hours: hoursBetween(stopped.start_time, stopped.end_time), projectName: running.project_name })
    }
    return stopped
  }

  const addEntry = async ({ projectId: entryProjectId, startTime, endTime, description }) => {
    const created = await runAdd(
      () => api.createTimeEntry(entryProjectId, startTime, description, endTime),
      msg`Time entry could not be saved.`
    )
    if (created) onSaved()
    return created
  }

  const savedHours = saved && formatHours(i18n, saved.hours)
  const savedProject = saved?.projectName

  const timerPanel = (
    <div className="flex flex-col gap-4">
      {!timer.activeEntry && (
        <div>
          <label htmlFor={selectId} className={ui.label}><Trans>Customer and project</Trans></label>
          <select
            id={selectId}
            value={projectId ?? ''}
            onChange={(e) => setProjectId(Number(e.target.value))}
            className={ui.input}
          >
            {projects.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
          </select>
        </div>
      )}
      {timer.activeEntry?.customer_name && (
        <p className="text-sm text-muted">{timer.activeEntry.customer_name}</p>
      )}
      <Timer project={project} activeEntry={timer.activeEntry} onStart={start} onStop={stop} error={timer.error} busy={timer.busy} bare />
      {saved && !timer.activeEntry && (
        <p className="text-sm text-muted"><Trans>Saved {savedHours} to {savedProject}.</Trans></p>
      )}
    </div>
  )

  const manualPanel = (
    <EntryForm
      projects={projects.map((p) => ({ id: p.id, name: label(p) }))}
      projectId={projectId}
      submitLabel={t`Add`}
      onSubmit={addEntry}
      error={addError}
    />
  )

  return (
    <section aria-labelledby={headingId} className={`${ui.card} flex flex-col gap-2`}>
      <h2 id={headingId} className="text-lg font-semibold"><Trans>Track time</Trans></h2>
      {projects.length === 0 ? (
        <p className="text-sm text-muted"><Trans>Add a customer and a project on the Time tracking page first.</Trans></p>
      ) : (
        <Tabs
          label={t`Track time`}
          tabs={[
            { id: 'timer', label: t`Timer`, panel: timerPanel },
            { id: 'manual', label: t`Manual entry`, panel: manualPanel },
          ]}
        />
      )}
    </section>
  )
}

export default TrackTimeCard
