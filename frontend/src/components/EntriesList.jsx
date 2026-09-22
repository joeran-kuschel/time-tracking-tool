import { useId, useRef } from 'react'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { formatHours, hoursBetween } from '../format'
import { useEditable } from '../hooks/useEditable'
import EntryForm from './EntryForm'
import ConfirmDelete from './ConfirmDelete'
import RecordActions from './RecordActions'

const dateTime = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }

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
      <tr className="border-b">
        <td colSpan={5} className="px-4 py-3">
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
    <tr className="border-b hover:bg-gray-50">
      <td className="px-4 py-2">{start}</td>
      <td className="px-4 py-2">{isRunning ? <Trans>Active</Trans> : i18n.date(entry.end_time, dateTime)}</td>
      <td className="px-4 py-2 text-right">{formatHours(i18n, hoursBetween(entry.start_time, entry.end_time))}</td>
      <td className="px-4 py-2 text-gray-600">{entry.description || '---'}</td>
      <td className="px-4 py-2">
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
      <h3 id={headingId} className="font-bold mb-2">
        {project.name} <span className="font-normal text-gray-600">· {t`${total} total`}</span>
      </h3>
      <table aria-labelledby={headingId} className="w-full text-sm">
        <thead>
          <tr className="bg-gray-100 border-b">
            <th className="px-4 py-2 text-left"><Trans>Start</Trans></th>
            <th className="px-4 py-2 text-left"><Trans>End</Trans></th>
            <th className="px-4 py-2 text-right"><Trans>Hours</Trans></th>
            <th className="px-4 py-2 text-left"><Trans>Description</Trans></th>
            <th className="px-4 py-2 text-right"><Trans>Actions</Trans></th>
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
        <p className="text-gray-500"><Trans>No entries yet</Trans></p>
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
