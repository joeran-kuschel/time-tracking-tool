import { useId, useRef } from 'react'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { formatClock, formatDay, formatHours, hoursBetween } from '../format'
import { useEditable } from '../hooks/useEditable'
import EntryForm from './EntryForm'
import ConfirmDelete from './ConfirmDelete'
import RecordActions from './RecordActions'

const dateTime = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
const cell = 'px-3 py-1.5 border-b border-line-soft'
const headCell = 'px-3 py-2 border-b border-line font-medium text-muted'

const messages = {
  saveFailed: msg`Time entry could not be saved.`,
  deleteFailed: msg`Time entry could not be deleted.`,
  stopTimerFirst: msg`Stop the running timer first.`,
}

// One entry; finished entries can be edited in place or deleted, running ones only stopped with the timer
function EntryRow({ entry, projects, onUpdate, onDelete, onDeleted }) {
  const { t, i18n } = useLingui()
  const editable = useEditable({ onUpdate: (changes) => onUpdate(entry, changes), onDelete: () => onDelete(entry), onDeleted, messages })
  const isRunning = !entry.end_time
  const start = i18n.date(entry.start_time, dateTime)

  if (editable.mode !== 'view') {
    return (
      <tr>
        <td colSpan={5} className={`${cell} py-3`}>
          {editable.mode === 'edit' ? (
            <EntryForm entry={entry} projects={projects} submitLabel={t`Save`} onSubmit={editable.save}
              onCancel={editable.cancel} error={editable.error} autoFocus />
          ) : (
            <ConfirmDelete message={t`Delete the entry from ${start}?`} onConfirm={editable.remove}
              onCancel={editable.cancel} error={editable.error} />
          )}
        </td>
      </tr>
    )
  }

  return (
    <tr className={isRunning ? 'bg-danger-soft/50' : 'hover:bg-paper/60'}>
      <td className={`${cell} whitespace-nowrap`}>{formatDay(i18n, entry.start_time)}</td>
      <td className={`${cell} whitespace-nowrap font-mono`}>
        {formatClock(i18n, entry.start_time)} –{' '}
        {isRunning
          ? <span className="font-sans font-semibold text-danger"><Trans>running</Trans></span>
          : formatClock(i18n, entry.end_time)}
      </td>
      <td className={`${cell} whitespace-nowrap text-right font-mono`}>{formatHours(i18n, hoursBetween(entry.start_time, entry.end_time))}</td>
      <td className={cell}>{entry.description || <span className="text-muted">—</span>}</td>
      <td className={cell}>
        {!isRunning && (
          <div className="flex justify-end gap-1">
            <RecordActions
              editLabel={t`Edit the entry from ${start}`}
              deleteLabel={t`Delete the entry from ${start}`}
              onEdit={editable.startEdit}
              onDelete={editable.startDelete}
              editButton={editable.editButton}
              deleteButton={editable.deleteButton}
            />
          </div>
        )}
      </td>
    </tr>
  )
}

// One project's entries under a heading with its total hours
function ProjectGroup({ project, entries, projects, onUpdate, onDelete, onDeleted }) {
  const { t, i18n } = useLingui()
  const headingId = useId()
  const total = formatHours(i18n, entries.reduce((sum, e) => sum + hoursBetween(e.start_time, e.end_time), 0))

  return (
    <div>
      <h3 id={headingId} className="mb-1 font-semibold">
        {project.name} <span className="font-normal text-muted">· {t`${total} total`}</span>
      </h3>
      <table aria-labelledby={headingId} className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left">
            <th scope="col" className={`${headCell} w-36`}><Trans>Date</Trans></th>
            <th scope="col" className={`${headCell} w-36`}><Trans>Time</Trans></th>
            <th scope="col" className={`${headCell} w-24 text-right`}><Trans>Hours</Trans></th>
            <th scope="col" className={headCell}><Trans>Description</Trans></th>
            <th scope="col" className={`${headCell} w-24 text-right`}><Trans>Actions</Trans></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} projects={projects} onUpdate={onUpdate} onDelete={onDelete} onDeleted={onDeleted} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Entries grouped by project, in the order of projects; projects without entries are left out.
// projects: the customer's projects, also the ones an entry can be moved to.
// After deleting, focus moves to the list, which stays even when the last entry is gone.
function EntriesList({ entries, projects, onUpdate, onDelete }) {
  const list = useRef(null)
  const groups = projects
    .map((project) => ({ project, entries: entries.filter((e) => e.project_id === project.id) }))
    .filter((group) => group.entries.length > 0)

  return (
    <div ref={list} tabIndex={-1} className="overflow-x-auto space-y-6">
      {groups.length === 0 ? (
        <p className="text-muted"><Trans>No entries yet</Trans></p>
      ) : (
        groups.map((group) => (
          <ProjectGroup key={group.project.id} project={group.project} entries={group.entries} projects={projects}
            onUpdate={onUpdate} onDelete={onDelete} onDeleted={() => list.current?.focus()} />
        ))
      )}
    </div>
  )
}

export default EntriesList
