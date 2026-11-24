// The task of a time entry (#121): the name that entries of one activity share, so reports sum the hours per day and task.

// The longest task, in characters (the backend refuses more)
export const MAX_TASK = 100

// The tasks of a project in the entries already loaded, the most recently worked on first, each once (ignoring case)
export function tasksOf(entries, projectId) {
  const seen = new Set()
  return entries
    .filter((entry) => entry.project_id === projectId && entry.task)
    .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
    .map((entry) => entry.task)
    .filter((task) => {
      const key = task.trim().toLocaleLowerCase('en')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}
