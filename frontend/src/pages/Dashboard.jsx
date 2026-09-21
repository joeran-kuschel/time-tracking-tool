import { useState, useEffect, useRef } from 'react'
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
import { formatRate } from '../format'

const stopTimerFirst = msg`Stop the running timer first.`
const customerMessages = { saveFailed: msg`Customer could not be saved.`, deleteFailed: msg`Customer could not be deleted.`, stopTimerFirst }
const projectMessages = { saveFailed: msg`Project could not be saved.`, deleteFailed: msg`Project could not be deleted.`, stopTimerFirst }

function Dashboard({ customers, onCustomersChange, timer }) {
  // Only ids are kept, so a renamed customer or project shows its new name right away
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [projects, setProjects] = useState([])
  const [entries, setEntries] = useState([])
  const [addingEntry, setAddingEntry] = useState(false)
  const [runCustomerAction, customerError] = useAction()
  const [runProjectAction, projectError] = useAction()
  const [runEntriesAction, entriesError] = useAction()
  const addEntryButton = useRef(null)
  const { t, i18n } = useLingui()

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) ?? null
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null

  useEffect(() => {
    if (selectedCustomerId) {
      loadProjects(selectedCustomerId)
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

  useEffect(() => {
    setAddingEntry(false)
    if (selectedProjectId) {
      loadEntries(selectedProjectId)
    } else {
      setEntries([])
    }
  }, [selectedProjectId])

  // Keeps the selected project if it still exists, else the running timer's project, else the first one
  const loadProjects = async (customerId) => {
    const data = await runProjectAction(() => api.getProjects(customerId), msg`Projects could not be loaded.`)
    if (!data) return
    setProjects(data)
    setSelectedProjectId((current) => {
      const keep = (id) => data.some((p) => p.id === id) && id
      return keep(current) || keep(timer.activeEntry?.project_id) || data[0]?.id || null
    })
  }

  const loadEntries = async (projectId) => {
    const data = await runEntriesAction(() => api.getTimeEntries(projectId), msg`Entries could not be loaded.`)
    if (data) setEntries(data)
  }

  const refreshEntries = () => selectedProjectId && loadEntries(selectedProjectId)

  // Customers
  const customerFields = [
    { name: 'name', label: t`Name`, required: true },
    { name: 'email', label: t`Email (optional)`, type: 'email' },
  ]
  const customerForm = { fields: customerFields, toValues: (c) => ({ name: c.name, email: c.email ?? '' }) }

  const addCustomer = async ({ name, email }) => {
    const created = await runCustomerAction(() => api.createCustomer(name.trim(), email.trim()), msg`Customer could not be created.`)
    if (created) onCustomersChange()
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
    const created = await runProjectAction(
      () => api.createProject(selectedCustomerId, name.trim(), toRate(hourlyRate)),
      msg`Project could not be created.`
    )
    if (created) loadProjects(selectedCustomerId)
    return created
  }

  const updateProject = async (project, { name, hourlyRate }) => {
    const saved = await api.updateProject(project.id, name.trim(), toRate(hourlyRate))
    await loadProjects(selectedCustomerId)
    return saved
  }

  const deleteProject = async (project) => {
    const deleted = await api.deleteProject(project.id)
    await loadProjects(selectedCustomerId)
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

  const closeAddEntry = () => {
    setAddingEntry(false)
    // the button only exists again after the form closed
    setTimeout(() => addEntryButton.current?.focus())
  }

  const addEntry = async ({ projectId, startTime, endTime, description }) => {
    const created = await runEntriesAction(
      () => api.createTimeEntry(projectId, startTime, description, endTime),
      msg`Time entry could not be saved.`
    )
    if (created) {
      await refreshEntries()
      closeAddEntry()
    }
    return created
  }

  // Reload the list after start/stop, so the running entry shows up right away
  const withEntriesRefresh = (action) => async (...args) => {
    const result = await action(...args)
    if (result) refreshEntries()
    return result
  }

  const selectedProjectName = selectedProject?.name

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customers Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4"><Trans>Customers</Trans></h2>
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
          <RecordForm
            legend={t`New customer`}
            fields={customerFields}
            initialValues={{ name: '', email: '' }}
            submitLabel={t`+ Add`}
            onSubmit={addCustomer}
            error={customerError}
          />
        </div>

        {/* Projects Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4"><Trans>Projects</Trans></h2>
          {selectedCustomer ? (
            <>
              <EditableList
                label={t`Projects`}
                items={projects}
                selectedId={selectedProjectId}
                onSelect={(project) => setSelectedProjectId(project.id)}
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
              <RecordForm
                key={selectedCustomerId}
                legend={t`New project`}
                fields={projectFields}
                initialValues={{ name: '', hourlyRate: '' }}
                submitLabel={t`+ Add`}
                onSubmit={addProject}
                error={projectError}
              />
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
      {selectedProject && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold"><Trans>Entries for {selectedProjectName}</Trans></h2>
            {!addingEntry && (
              <button ref={addEntryButton} onClick={() => setAddingEntry(true)}
                className="px-3 py-2 rounded text-sm bg-green-700 text-white hover:bg-green-800">
                <Trans>Add time</Trans>
              </button>
            )}
          </div>
          {addingEntry && (
            <EntryForm
              projects={projects}
              projectId={selectedProjectId}
              legend={t`Add time`}
              submitLabel={t`Save`}
              onSubmit={addEntry}
              onCancel={closeAddEntry}
              error={entriesError}
              autoFocus
            />
          )}
          {!addingEntry && <ErrorMessage message={entriesError} />}
          <EntriesList entries={entries} projects={projects} onUpdate={updateEntry} onDelete={deleteEntry} />
        </div>
      )}
    </div>
  )
}

export default Dashboard
