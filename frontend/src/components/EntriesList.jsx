import { useId, useRef } from 'react'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { formatClock, formatDay, formatDuration, minutesBetween } from '../format'
import Duration from './Duration'
import { useEditable } from '../hooks/useEditable'
import EntryForm from './EntryForm'
import ConfirmDelete from './ConfirmDelete'
import RecordActions from './RecordActions'
import ResumeButton, { ResumeHints } from './ResumeButton'
import EntryText from './EntryText'
import EntrySelect from './EntrySelect'
import SelectCheckbox from './SelectCheckbox'
import { tasksOf } from '../tasks'

const dateTime = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
const cell = 'px-3 py-1.5 border-b border-line-soft'
const headCell = 'px-3 py-2 border-b border-line font-medium text-muted'

const messages = {
  saveFailed: msg`Time entry could not be saved.`,
  deleteFailed: msg`Time entry could not be deleted.`,
  stopTimerFirst: msg`Stop the running timer first.`,
}

// One entry; finished entries can be resumed, edited in place or deleted, running ones only stopped with the timer.
// resume: see ResumeButton
// taskSuggestions: the project's earlier tasks, for the Task field of the edit form
// selection: useSelection(), for the checkbox that selects the entry (without it, no checkbox column)
function EntryRow({ entry, projects, onUpdate, onDelete, onDeleted, resume, taskSuggestions, selection }) {
  const { t, i18n } = useLingui()
  const editable = useEditable({ onUpdate: (changes) => onUpdate(entry, changes), onDelete: () => onDelete(entry), onDeleted, messages })
  const isRunning = !entry.end_time
  const start = i18n.date(entry.start_time, dateTime)
  const projectName = projects.find((p) => p.id === entry.project_id)?.name ?? ''

  if (editable.mode !== 'view') {
    return (
      <tr>
        <td colSpan={selection ? 6 : 5} className={`${cell} py-3`}>
          {editable.mode === 'edit' ? (
            <EntryForm entry={entry} projects={projects} taskSuggestions={taskSuggestions} submitLabel={t`Save`} onSubmit={editable.save}
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
      {selection && <td className={cell}><EntrySelect entry={entry} projectName={projectName} selection={selection} /></td>}
      <td className={`${cell} whitespace-nowrap`}>{formatDay(i18n, entry.start_time)}</td>
      <td className={`${cell} whitespace-nowrap font-mono`}>
        {formatClock(i18n, entry.start_time)} –{' '}
        {isRunning
          ? <span className="font-sans font-semibold text-danger"><Trans>running</Trans></span>
          : formatClock(i18n, entry.end_time)}
      </td>
      <td className={`${cell} whitespace-nowrap text-right font-mono`}><Duration minutes={minutesBetween(entry.start_time, entry.end_time)} /></td>
      <td className={cell}><EntryText entry={entry} empty={<span className="text-muted">—</span>} /></td>
      <td className={cell}>
        {!isRunning && (
          <div className="flex justify-end gap-1">
            <ResumeButton entry={entry} projectName={projectName} resume={resume} />
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

// One project's entries under a heading with its total time
function ProjectGroup({ project, entries, projects, onUpdate, onDelete, onDeleted, resume, selection }) {
  const { t, i18n } = useLingui()
  const headingId = useId()
  const total = formatDuration(i18n, entries.reduce((sum, e) => sum + minutesBetween(e.start_time, e.end_time), 0))
  const tasks = tasksOf(entries, project.id)
  // Lingui takes a plain name for a placeholder, not project.name
  const projectName = project.name
  // The finished entries a checkbox can select; the one in the header selects or unselects all of them
  const selectable = entries.filter((e) => e.end_time).map((e) => e.id)
  const selectedCount = selection ? selectable.filter((id) => selection.has(id)).length : 0

  return (
    <div>
      <h3 id={headingId} className="mb-1 font-semibold">
        {project.name} <span className="font-normal text-muted">· {t`${total} total`}</span>
      </h3>
      <table aria-labelledby={headingId} className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left">
            {selection && (
              <th scope="col" className={`${headCell} w-10`}>
                <span className="sr-only"><Trans>Select</Trans></span>
                {selectable.length > 0 && (
                  <SelectCheckbox label={t`Select all of ${projectName}`} checked={selectedCount === selectable.length} indeterminate={selectedCount > 0 && selectedCount < selectable.length}
                    onChange={(on) => selection.setMany(selectable, on)} />
                )}
              </th>
            )}
            <th scope="col" className={`${headCell} w-36`}><Trans>Date</Trans></th>
            <th scope="col" className={`${headCell} w-36`}><Trans>Time</Trans></th>
            <th scope="col" className={`${headCell} w-24 text-right`}><Trans>Hours</Trans></th>
            <th scope="col" className={headCell}><Trans>Task and description</Trans></th>
            <th scope="col" className={`${headCell} w-24 text-right`}><Trans>Actions</Trans></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} projects={projects} onUpdate={onUpdate} onDelete={onDelete} onDeleted={onDeleted} resume={resume} taskSuggestions={tasks} selection={selection} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Entries grouped by project, in the order of projects; projects without entries are left out.
// projects: the customer's projects, also the ones an entry can be moved to.
// After deleting, focus moves to the list, which stays even when the last entry is gone.
// resume: for the Resume buttons, see ResumeButton (without it, no buttons).
// selection: useSelection(); with it, finished entries have a checkbox (to set their task together, see SetTaskBar).
function EntriesList({ entries, projects, onUpdate, onDelete, resume, selection }) {
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
            onUpdate={onUpdate} onDelete={onDelete} onDeleted={() => list.current?.focus()} resume={resume} selection={selection} />
        ))
      )}
      {resume && <ResumeHints />}
    </div>
  )
}

export default EntriesList
