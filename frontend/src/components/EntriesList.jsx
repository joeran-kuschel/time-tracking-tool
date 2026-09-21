import { useRef } from 'react'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { formatHours, hoursBetween } from '../format'
import { useEditable } from '../hooks/useEditable'
import EntryForm from './EntryForm'
import ConfirmDelete from './ConfirmDelete'

const dateTime = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }

const messages = {
  saveFailed: msg`Time entry could not be saved.`,
  deleteFailed: msg`Time entry could not be deleted.`,
  stopTimerFirst: msg`Stop the running timer first.`,
}

const actionClass = 'px-2 py-1 rounded text-sm border border-gray-300 text-gray-700 hover:bg-gray-100'

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
            <button ref={editable.editButton} onClick={editable.startEdit} aria-label={t`Edit the entry from ${start}`} className={actionClass}>
              <Trans>Edit</Trans>
            </button>
            <button ref={editable.deleteButton} onClick={editable.startDelete} aria-label={t`Delete the entry from ${start}`} className={actionClass}>
              <Trans>Delete</Trans>
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

// projects: the projects an entry can be moved to (those of the same customer)
// After deleting, focus moves to the list, which stays even when the last entry is gone.
function EntriesList({ entries, projects, onUpdate, onDelete }) {
  const list = useRef(null)

  return (
    <div ref={list} tabIndex={-1} className="overflow-x-auto">
      {entries.length === 0 ? (
        <p className="text-gray-500"><Trans>No entries yet</Trans></p>
      ) : (
      <table className="w-full text-sm">
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
            <EntryRow key={entry.id} entry={entry} projects={projects} onUpdate={onUpdate} onDelete={onDelete}
              onDeleted={() => list.current?.focus()} />
          ))}
        </tbody>
      </table>
      )}
    </div>
  )
}

export default EntriesList
