import { useState, useEffect } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { api } from '../api'
import { useAction } from '../hooks/useAction'
import ErrorMessage from '../components/ErrorMessage'
import Timer from '../components/Timer'
import EntriesList from '../components/EntriesList'
import EditableList from '../components/EditableList'
import RecordForm from '../components/RecordForm'
import EntryForm from '../components/EntryForm'
import Modal from '../components/Modal'
import { formatRate } from '../format'

const stopTimerFirst = msg`Stop the running timer first.`
const customerMessages = { saveFailed: msg`Customer could not be saved.`, deleteFailed: msg`Customer could not be deleted.`, stopTimerFirst }
const addButtonClass = 'inline-flex items-center gap-1 px-3 py-2 rounded text-sm bg-green-700 text-white hover:bg-green-800'
const projectMessages = { saveFailed: msg`Project could not be saved.`, deleteFailed: msg`Project could not be deleted.`, stopTimerFirst }

function Dashboard({ customers, onCustomersChange, timer }) {
  // Only ids are kept, so a renamed customer or project shows its new name right away
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [projects, setProjects] = useState([])
  const [entries, setEntries] = useState([])
  // The open add dialog: 'customer', 'project', 'entry' or null
  const [dialog, setDialog] = useState(null)
  const [runAdd, addError, clearAddError] = useAction()
  const [runProjectAction, projectError] = useAction()
  const [runEntriesAction, entriesError] = useAction()
  const { t, i18n } = useLingui()

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) ?? null
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null

  useEffect(() => {
    setEntries([])
    if (selectedCustomerId) {
      loadProjects(selectedCustomerId)
      loadEntries(selectedCustomerId)
    } else {
      setProjects([])
      setSelectedProjectId(null)
    }
  }, [selectedCustomerId])

  // After a reload, open the customer of the running timer
  useEffect(() => {
    if (!selectedCustomerId && timer.activeEntry) {
      const customer = customers.find((c) => c.id === timer.activeEntry.customer_id)
      if (customer) setSelectedCustomerId(customer.id)
    }
  }, [customers, timer.activeEntry])

  // Keeps the selected project if it still exists, else selects the running timer's project, else none
  const loadProjects = async (customerId) => {
    const data = await runProjectAction(() => api.getProjects(customerId), msg`Projects could not be loaded.`)
    if (!data) return
    setProjects(data)
    setSelectedProjectId((current) => {
      const keep = (id) => data.some((p) => p.id === id) && id
      return keep(current) || keep(timer.activeEntry?.project_id) || null
    })
  }

  // All entries of the customer; a selected project only narrows what is shown
  const loadEntries = async (customerId) => {
    const data = await runEntriesAction(() => api.getCustomerTimeEntries(customerId), msg`Entries could not be loaded.`)
    if (data) setEntries(data)
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
  const customerForm = { fields: customerFields, toValues: (c) => ({ name: c.name, email: c.email ?? '' }) }

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
    if (customer.id === selectedCustomerId) setSelectedCustomerId(null)
    await onCustomersChange()
    return deleted
  }

  // Projects
  const projectFields = [
    { name: 'name', label: t`Name`, required: true },
    { name: 'hourlyRate', label: t`Hourly rate (€)`, type: 'number', min: 0, step: 0.01 },
  ]
  const projectForm = { fields: projectFields, toValues: (p) => ({ name: p.name, hourlyRate: String(Number(p.hourly_rate)) }) }
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

  // Reload the list after start/stop, so the running entry shows up right away
  const withEntriesRefresh = (action) => async (...args) => {
    const result = await action(...args)
    if (result) refreshEntries()
    return result
  }

  const visibleEntries = selectedProject ? entries.filter((e) => e.project_id === selectedProject.id) : entries
  const entriesOf = selectedProject?.name ?? selectedCustomer?.name

  return (
    <>
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customers Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-bold"><Trans>Customers</Trans></h2>
            <button onClick={() => openDialog('customer')} className={addButtonClass}>
              <PlusIcon aria-hidden="true" className="h-4 w-4" />
              <Trans>New customer</Trans>
            </button>
          </div>
          <EditableList
            label={t`Customers`}
            items={customers}
            selectedId={selectedCustomerId}
            onSelect={(customer) => setSelectedCustomerId(customer.id)}
            renderItem={(customer) => customer.name}
            form={customerForm}
            onUpdate={updateCustomer}
            onDelete={deleteCustomer}
            deleteMessage={({ name: customerName }) => t`Delete ${customerName} and all its projects and time entries?`}
            messages={customerMessages}
          />
        </div>

        {/* Projects Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-bold"><Trans>Projects</Trans></h2>
            {selectedCustomer && (
              <button onClick={() => openDialog('project')} className={addButtonClass}>
                <PlusIcon aria-hidden="true" className="h-4 w-4" />
                <Trans>New project</Trans>
              </button>
            )}
          </div>
          {selectedCustomer ? (
            <>
              <EditableList
                label={t`Projects`}
                items={projects}
                selectedId={selectedProjectId}
                onSelect={(project) => setSelectedProjectId((current) => (current === project.id ? null : project.id))}
                renderItem={(project, selected) => (
                  <>
                    <div>{project.name}</div>
                    <div className={`text-xs ${selected ? 'text-blue-100' : 'text-gray-600'}`}>{formatRate(i18n, project.hourly_rate)}</div>
                  </>
                )}
                form={projectForm}
                onUpdate={updateProject}
                onDelete={deleteProject}
                deleteMessage={({ name: projectName }) => t`Delete ${projectName} and all its time entries?`}
                messages={projectMessages}
              />
              <ErrorMessage message={projectError} />
            </>
          ) : (
            <p className="text-gray-500"><Trans>Select a customer</Trans></p>
          )}
        </div>

        {/* Timer Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <Timer
            project={selectedProject}
            activeEntry={timer.activeEntry}
            onStart={withEntriesRefresh((description) => timer.start(selectedProject, description))}
            onStop={withEntriesRefresh(timer.stop)}
            error={timer.error}
          />
        </div>
      </div>

      {/* Entries List */}
      {/* All entries of the customer, or only those of the selected project */}
      {selectedCustomer && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold"><Trans>Entries for {entriesOf}</Trans></h2>
            {projects.length > 0 && (
              <button onClick={() => openDialog('entry')} className={addButtonClass}>
                <PlusIcon aria-hidden="true" className="h-4 w-4" />
                <Trans>Add time</Trans>
              </button>
            )}
          </div>
          <ErrorMessage message={entriesError} />
          <EntriesList entries={visibleEntries} projects={projects} onUpdate={updateEntry} onDelete={deleteEntry} />
        </div>
      )}
    </div>

      {/* Outside the space-y container, whose margins would pull the dialogs off center */}
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
    </>
  )
}

export default Dashboard
