import { useState, useEffect, useId, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { PlusIcon } from '@heroicons/react/24/outline'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '../api'
import { useAction } from '../hooks/useAction'
import ErrorMessage from '../components/ErrorMessage'
import MissingRecord from '../components/MissingRecord'
import Timer from '../components/Timer'
import MonthSummary from '../components/MonthSummary'
import EntriesList from '../components/EntriesList'
import EditableRecord from '../components/EditableRecord'
import RecordForm from '../components/RecordForm'
import EntryForm from '../components/EntryForm'
import Modal from '../components/Modal'
import { formatRate } from '../format'
import { idFromParam, trackingPath } from '../routes'
import { ui } from '../ui'

const stopTimerFirst = msg`Stop the running timer first.`
const customerMessages = { saveFailed: msg`Customer could not be saved.`, deleteFailed: msg`Customer could not be deleted.`, stopTimerFirst }
const projectMessages = { saveFailed: msg`Project could not be saved.`, deleteFailed: msg`Project could not be deleted.`, stopTimerFirst }

const chipClass = (selected) => `inline-flex min-h-[2.5rem] items-center gap-2 rounded-full border px-4 text-sm ${
  selected ? 'border-accent bg-accent font-semibold text-on-fill' : 'border-line-strong bg-surface text-ink hover:bg-paper'
}`

// The selected customer and project are in the address (/time-tracking/:customerId/:projectId), so a reload, a
// bookmark or a link from another page opens them. Only ids are kept, so a renamed record shows its new name right away.
function TimeTracking({ customers, onCustomersChange, timer }) {
  const params = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const requestedCustomerId = idFromParam(params.customerId)
  const requestedProjectId = idFromParam(params.projectId)
  const [projects, setProjects] = useState([])
  // The customer whose projects are in `projects`, so a project that is not among them is only reported after the load
  const [projectsOf, setProjectsOf] = useState(null)
  const [entries, setEntries] = useState([])
  // The open add dialog: 'customer', 'project', 'entry' or null
  const [dialog, setDialog] = useState(null)
  const [runAdd, addError, clearAddError] = useAction()
  const [runProjectAction, projectError] = useAction()
  const [runEntriesAction, entriesError] = useAction()
  const { t, i18n } = useLingui()
  // After deleting, focus moves to the list the record was in
  const customerList = useRef(null)
  const projectGroup = useRef(null)
  // The project filter is rendered anew once the selected project is gone, so focus it after that render
  const [projectFocusRequest, setProjectFocusRequest] = useState(0)
  const customersHeadingId = useId()
  const entriesHeadingId = useId()

  useEffect(() => {
    if (projectFocusRequest) projectGroup.current?.focus()
  }, [projectFocusRequest])

  const selectedCustomer = customers.find((c) => c.id === requestedCustomerId) ?? null
  const selectedCustomerId = selectedCustomer?.id ?? null
  const selectedProject = projects.find((p) => p.id === requestedProjectId) ?? null
  const selectedProjectId = selectedProject?.id ?? null
  // An address for a record that does not exist (any more)
  const customerMissing = Boolean(params.customerId) && !selectedCustomer
  const projectMissing = Boolean(params.projectId) && Boolean(selectedCustomer) && !selectedProject
    && (requestedProjectId === null || projectsOf === selectedCustomerId)

  // The customer shown now; answers that arrive for a customer selected before are dropped
  const shownCustomerId = useRef(selectedCustomerId)

  useEffect(() => {
    shownCustomerId.current = selectedCustomerId
    // Nothing of the previous customer stays, so Start waits for this customer's projects
    setEntries([])
    setProjects([])
    setProjectsOf(null)
    if (selectedCustomerId) {
      loadProjects(selectedCustomerId)
      loadEntries(selectedCustomerId)
    }
  }, [selectedCustomerId])

  // On the page without a customer (after a reload, say), open the customer and project of the running timer, once
  const timerOpened = useRef(false)
  useEffect(() => {
    if (params.customerId) timerOpened.current = true
    if (timerOpened.current || !timer.activeEntry) return
    const { customer_id: customerId, project_id: projectId } = timer.activeEntry
    if (customers.some((c) => c.id === customerId)) {
      timerOpened.current = true
      navigate(trackingPath(customerId, projectId), { replace: true })
    }
  }, [customers, timer.activeEntry, params.customerId])

  // Reload the entries when a timer starts or stops, also from the header, so the running entry shows up right away
  const activeId = timer.activeEntry?.id
  const previousActiveId = useRef(activeId)
  useEffect(() => {
    if (previousActiveId.current === activeId) return
    previousActiveId.current = activeId
    refreshEntries()
  }, [activeId])

  const loadProjects = async (customerId) => {
    const data = await runProjectAction(() => api.getProjects(customerId), msg`Projects could not be loaded.`)
    if (!data || customerId !== shownCustomerId.current) return
    setProjects(data)
    setProjectsOf(customerId)
  }

  // Choosing a customer or a project adds a history entry, so Back undoes it. With a timer running for the customer,
  // its project is selected right away.
  // Choosing what is already open adds nothing, so Back doesn't seem to do nothing once
  const choose = (to) => { if (to !== pathname) navigate(to) }
  const openCustomer = (customerId) => {
    const running = timer.activeEntry?.customer_id === customerId
    choose(trackingPath(customerId, running ? timer.activeEntry.project_id : null))
  }
  const toggleProject = (projectId) =>
    choose(trackingPath(selectedCustomerId, projectId === selectedProjectId ? null : projectId))

  // All entries of the customer; a selected project only narrows what is shown
  const loadEntries = async (customerId) => {
    const data = await runEntriesAction(() => api.getCustomerTimeEntries(customerId), msg`Entries could not be loaded.`)
    if (data && customerId === shownCustomerId.current) setEntries(data)
  }

  const refreshEntries = () => selectedCustomerId && loadEntries(selectedCustomerId)

  const openDialog = (name) => {
    clearAddError()
    setDialog(name)
  }
  const closeDialog = () => setDialog(null)

  // Customers
  const customerFields = [
    { name: 'name', label: t`Name`, required: true },
    { name: 'email', label: t`Email (optional)`, type: 'email' },
  ]
  const customerForm = { legend: t`Edit customer`, fields: customerFields, toValues: (c) => ({ name: c.name, email: c.email ?? '' }) }

  const addCustomer = async ({ name, email }) => {
    const created = await runAdd(() => api.createCustomer(name.trim(), email.trim()), msg`Customer could not be created.`)
    if (created) {
      closeDialog()
      onCustomersChange()
    }
    return created
  }

  const updateCustomer = async (customer, { name, email }) => {
    const saved = await api.updateCustomer(customer.id, name.trim(), email.trim())
    await onCustomersChange()
    return saved
  }

  const deleteCustomer = async (customer) => {
    const deleted = await api.deleteCustomer(customer.id)
    if (customer.id === selectedCustomerId) navigate(trackingPath(), { replace: true })
    await onCustomersChange()
    return deleted
  }

  // Projects
  const projectFields = [
    { name: 'name', label: t`Name`, required: true },
    { name: 'hourlyRate', label: t`Hourly rate (€)`, type: 'number', min: 0, step: 0.01 },
  ]
  const projectForm = { legend: t`Edit project`, fields: projectFields, toValues: (p) => ({ name: p.name, hourlyRate: String(Number(p.hourly_rate)) }) }
  const toRate = (value) => (value === '' ? 0 : Number(value))

  const addProject = async ({ name, hourlyRate }) => {
    const created = await runAdd(
      () => api.createProject(selectedCustomerId, name.trim(), toRate(hourlyRate)),
      msg`Project could not be created.`
    )
    if (created) {
      closeDialog()
      loadProjects(selectedCustomerId)
    }
    return created
  }

  const updateProject = async (project, { name, hourlyRate }) => {
    const saved = await api.updateProject(project.id, name.trim(), toRate(hourlyRate))
    await loadProjects(selectedCustomerId)
    return saved
  }

  const deleteProject = async (project) => {
    const deleted = await api.deleteProject(project.id)
    if (project.id === selectedProjectId) navigate(trackingPath(selectedCustomerId), { replace: true })
    await Promise.all([loadProjects(selectedCustomerId), refreshEntries()])
    return deleted
  }

  // Time entries
  const updateEntry = async (entry, changes) => {
    const saved = await api.updateTimeEntry(entry.id, changes)
    await refreshEntries()
    return saved
  }

  const deleteEntry = async (entry) => {
    const deleted = await api.deleteTimeEntry(entry.id)
    await refreshEntries()
    return deleted
  }

  const addEntry = async ({ projectId, startTime, endTime, description }) => {
    const created = await runAdd(
      () => api.createTimeEntry(projectId, startTime, description, endTime),
      msg`Time entry could not be saved.`
    )
    if (created) {
      closeDialog()
      refreshEntries()
    }
    return created
  }

  const visibleEntries = selectedProject ? entries.filter((e) => e.project_id === selectedProject.id) : entries
  const entriesOf = selectedProject?.name ?? selectedCustomer?.name

  // The project filter; actions edit and delete the selected project
  const projectFilter = (actions) => (
    <div className="flex flex-wrap items-center gap-2">
      <div ref={projectGroup} tabIndex={-1} role="group" aria-label={t`Projects`} className="flex flex-wrap items-center gap-2">
        {projects.length > 0 && (
          <button onClick={() => toggleProject(null)} aria-pressed={!selectedProject} className={chipClass(!selectedProject)}>
            <Trans>All projects</Trans>
          </button>
        )}
        {projects.map((project) => {
          const selected = project.id === selectedProjectId
          return (
            <button
              key={project.id}
              onClick={() => toggleProject(project.id)}
              aria-pressed={selected}
              className={chipClass(selected)}
            >
              {project.name}
              <span className={selected ? 'font-normal text-on-fill/90' : 'text-muted'}>{formatRate(i18n, project.hourly_rate)}</span>
            </button>
          )
        })}
        <button
          onClick={() => openDialog('project')}
          className="inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3.5 text-sm text-ink hover:bg-surface"
        >
          <PlusIcon aria-hidden="true" className="h-4 w-4" />
          <Trans>New project</Trans>
        </button>
      </div>
      {actions && <div className="ml-auto flex gap-1">{actions}</div>}
    </div>
  )

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <aside
        aria-labelledby={customersHeadingId}
        className="border-b border-line bg-surface p-4 lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r lg:py-6"
      >
        <div className="mb-3 flex items-center justify-between gap-2 px-2">
          <h2 id={customersHeadingId} className={ui.eyebrow}><Trans>Customers</Trans></h2>
          <button onClick={() => openDialog('customer')} title={t`New customer`} className={`${ui.iconButton} border border-line`}>
            <PlusIcon aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <ul ref={customerList} tabIndex={-1} aria-label={t`Customers`} className="flex flex-wrap gap-1 lg:flex-col">
          {customers.map((customer) => {
            const selected = customer.id === selectedCustomerId
            const running = customer.id === timer.activeEntry?.customer_id
            return (
              <li key={customer.id} className="lg:w-full">
                <button
                  onClick={() => openCustomer(customer.id)}
                  aria-pressed={selected}
                  className={`flex min-h-[2.75rem] w-full items-center gap-2.5 rounded-lg px-3 text-left text-[0.9375rem] ${
                    selected ? 'bg-accent-soft font-semibold text-accent-dark' : 'text-ink hover:bg-paper'
                  }`}
                >
                  <span className="flex-1 truncate">{customer.name}</span>
                  {running && (
                    <>
                      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-danger" />
                      <span className="sr-only"><Trans>, timer running</Trans></span>
                    </>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-5 p-4 sm:p-8">
        {selectedCustomer ? (
          <>
            <EditableRecord
              key={selectedCustomer.id}
              item={selectedCustomer}
              form={customerForm}
              onUpdate={updateCustomer}
              onDelete={deleteCustomer}
              deleteMessage={({ name: customerName }) => t`Delete ${customerName} and all its projects and time entries?`}
              messages={customerMessages}
              onDeleted={() => customerList.current?.focus()}
            >
              {(actions) => (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-0 flex-1">
                    <h1 className="font-serif text-4xl font-semibold leading-tight">{selectedCustomer.name}</h1>
                    {selectedCustomer.email && <p className="text-sm text-muted">{selectedCustomer.email}</p>}
                  </div>
                  <div className="flex gap-1">{actions}</div>
                </div>
              )}
            </EditableRecord>

            {selectedProject ? (
              <EditableRecord
                key={selectedProject.id}
                item={selectedProject}
                form={projectForm}
                onUpdate={updateProject}
                onDelete={deleteProject}
                deleteMessage={({ name: projectName }) => t`Delete ${projectName} and all its time entries?`}
                messages={projectMessages}
                onDeleted={() => setProjectFocusRequest((n) => n + 1)}
              >
                {projectFilter}
              </EditableRecord>
            ) : (
              projectFilter(null)
            )}
            {projectMissing && (
              <MissingRecord
                message={t`This project does not exist (any more).`}
                to={trackingPath(selectedCustomerId)}
                linkText={t`Show all projects`}
              />
            )}
            <ErrorMessage message={projectError} />
          </>
        ) : (
          <>
            <h1 className="sr-only"><Trans>Time tracking</Trans></h1>
            {customerMissing && (
              <MissingRecord
                message={t`This customer does not exist (any more).`}
                to={trackingPath()}
                linkText={t`Back to Time tracking`}
              />
            )}
            <p className="text-muted"><Trans>Select a customer</Trans></p>
          </>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <Timer
            project={selectedProject}
            activeEntry={timer.activeEntry}
            onStart={(description) => timer.start(selectedProject, description, selectedCustomer)}
            onStop={timer.stop}
            error={timer.error}
            busy={timer.busy}
          />
          {selectedCustomer && (
            <MonthSummary entries={entries} projects={projects} customerId={selectedCustomer.id} />
          )}
        </div>

        {/* All entries of the customer, or only those of the selected project */}
        {selectedCustomer && (
          <section aria-labelledby={entriesHeadingId} className={`${ui.card} flex flex-col gap-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id={entriesHeadingId} className="text-lg font-semibold"><Trans>Entries for {entriesOf}</Trans></h2>
              {projects.length > 0 && (
                <button onClick={() => openDialog('entry')} className={ui.buttonSecondary}>
                  <PlusIcon aria-hidden="true" className="h-4 w-4" />
                  <Trans>Add time</Trans>
                </button>
              )}
            </div>
            <ErrorMessage message={entriesError} />
            <EntriesList entries={visibleEntries} projects={projects} onUpdate={updateEntry} onDelete={deleteEntry} />
          </section>
        )}
      </div>

      <Modal title={t`New customer`} open={dialog === 'customer'} onClose={closeDialog}>
        <RecordForm fields={customerFields} initialValues={{ name: '', email: '' }} submitLabel={t`Save`}
          onSubmit={addCustomer} onCancel={closeDialog} error={addError} />
      </Modal>
      <Modal title={t`New project`} open={dialog === 'project'} onClose={closeDialog}>
        <RecordForm fields={projectFields} initialValues={{ name: '', hourlyRate: '' }} submitLabel={t`Save`}
          onSubmit={addProject} onCancel={closeDialog} error={addError} />
      </Modal>
      <Modal title={t`Add time`} open={dialog === 'entry'} onClose={closeDialog}>
        <EntryForm projects={projects} projectId={selectedProjectId ?? projects[0]?.id} submitLabel={t`Save`}
          onSubmit={addEntry} onCancel={closeDialog} error={addError} />
      </Modal>
    </div>
  )
}

export default TimeTracking
