import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAction } from '../hooks/useAction'
import ErrorMessage from '../components/ErrorMessage'
import Timer from '../components/Timer'
import EntriesList from '../components/EntriesList'

function Dashboard({ customers, onCustomersChange }) {
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [projects, setProjects] = useState([])
  const [entries, setEntries] = useState([])
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectRate, setNewProjectRate] = useState('')
  const [runCustomerAction, customerError] = useAction()
  const [runProjectAction, projectError] = useAction()
  const [runEntriesAction, entriesError] = useAction()

  useEffect(() => {
    if (selectedCustomer) {
      loadProjects(selectedCustomer.id)
    }
  }, [selectedCustomer])

  useEffect(() => {
    if (selectedProject) {
      loadEntries(selectedProject.id)
    }
  }, [selectedProject])

  const loadProjects = async (customerId) => {
    const data = await runProjectAction(() => api.getProjects(customerId), 'Projekte konnten nicht geladen werden.')
    if (!data) return
    setProjects(data)
    setSelectedProject(data[0] || null)
  }

  const loadEntries = async (projectId) => {
    const data = await runEntriesAction(() => api.getTimeEntries(projectId), 'Einträge konnten nicht geladen werden.')
    if (data) setEntries(data)
  }

  const handleAddCustomer = async (e) => {
    e.preventDefault()
    if (!newCustomerName.trim()) return

    const created = await runCustomerAction(() => api.createCustomer(newCustomerName), 'Kunde konnte nicht angelegt werden.')
    if (!created) return
    setNewCustomerName('')
    onCustomersChange()
  }

  const handleAddProject = async (e) => {
    e.preventDefault()
    if (!selectedCustomer || !newProjectName.trim()) return

    const created = await runProjectAction(
      () => api.createProject(selectedCustomer.id, newProjectName, parseFloat(newProjectRate) || 0),
      'Projekt konnte nicht angelegt werden.'
    )
    if (!created) return
    setNewProjectName('')
    setNewProjectRate('')
    loadProjects(selectedCustomer.id)
  }

  const handleEntryCreated = () => {
    if (selectedProject) {
      loadEntries(selectedProject.id)
    }
  }

  const handleEntryStopped = () => {
    if (selectedProject) {
      loadEntries(selectedProject.id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customers Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Kunden</h2>
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {customers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className={`w-full text-left px-3 py-2 rounded ${
                  selectedCustomer?.id === customer.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {customer.name}
              </button>
            ))}
          </div>

          <form onSubmit={handleAddCustomer} className="space-y-2">
            <input
              type="text"
              placeholder="Neuer Kunde"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
            <button
              type="submit"
              className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              + Hinzufügen
            </button>
            <ErrorMessage message={customerError} />
          </form>
        </div>

        {/* Projects Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Projekte</h2>
          {selectedCustomer ? (
            <>
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProject(project)}
                    className={`w-full text-left px-3 py-2 rounded text-sm ${
                      selectedProject?.id === project.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <div>{project.name}</div>
                    <div className="text-xs opacity-75">{project.hourly_rate}€/h</div>
                  </button>
                ))}
              </div>

              <form onSubmit={handleAddProject} className="space-y-2">
                <input
                  type="text"
                  placeholder="Projektname"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
                <input
                  type="number"
                  placeholder="Stundensatz €"
                  value={newProjectRate}
                  onChange={(e) => setNewProjectRate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
                <button
                  type="submit"
                  className="w-full px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                >
                  + Hinzufügen
                </button>
                <ErrorMessage message={projectError} />
              </form>
            </>
          ) : (
            <p className="text-gray-500">Wähle einen Kunden</p>
          )}
        </div>

        {/* Timer Section */}
        <div className="bg-white rounded-lg shadow p-6">
          {selectedProject ? (
            <Timer project={selectedProject} onEntryCreated={handleEntryCreated} onEntryStopped={handleEntryStopped} />
          ) : (
            <p className="text-gray-500">Wähle ein Projekt</p>
          )}
        </div>
      </div>

      {/* Entries List */}
      {selectedProject && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Einträge für {selectedProject.name}</h2>
          <ErrorMessage message={entriesError} />
          <EntriesList entries={entries} />
        </div>
      )}
    </div>
  )
}

export default Dashboard
