import { useEffect, useState } from 'react'
import { api } from '../api'

// The tasks used in a project, for the suggestions of a Task field where the entries are not loaded (the Dashboard).
// Suggestions are a convenience: a failed request leaves the list empty and shows no error. reloadKey: a value that,
// when it changes, loads the list again (for example after an entry was saved).
export function useTaskSuggestions(projectId, reloadKey) {
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    let current = true
    if (!projectId) {
      setTasks([])
      return undefined
    }
    api.getTasks(projectId).then((list) => current && setTasks(Array.isArray(list) ? list : [])).catch(() => current && setTasks([]))
    return () => { current = false }
  }, [projectId, reloadKey])

  return tasks
}
