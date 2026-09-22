import { hoursBetween } from './format'

// Whether the entry started in the month of the given date, in local time
export function inMonth(entry, date) {
  const start = new Date(entry.start_time)
  return start.getFullYear() === date.getFullYear() && start.getMonth() === date.getMonth()
}

// Hours and amounts (hours × hourly rate) of finished entries, in total and per project.
// projects: [{ id, name, hourly_rate }] in display order; projects without hours are left out.
export function summarize(entries, projects) {
  const finished = entries.filter((e) => e.end_time)
  const perProject = projects
    .map((project) => {
      const hours = finished
        .filter((e) => e.project_id === project.id)
        .reduce((sum, e) => sum + hoursBetween(e.start_time, e.end_time), 0)
      return { project, hours, amount: hours * Number(project.hourly_rate ?? 0) }
    })
    .filter((p) => p.hours > 0)

  return {
    hours: perProject.reduce((sum, p) => sum + p.hours, 0),
    amount: perProject.reduce((sum, p) => sum + p.amount, 0),
    count: finished.length,
    projects: perProject,
  }
}

// The projects of report entries ({ project_id, project_name, hourly_rate }), in the order they first appear
export function projectsOf(entries) {
  const byId = new Map()
  for (const e of entries) {
    if (!byId.has(e.project_id)) byId.set(e.project_id, { id: e.project_id, name: e.project_name, hourly_rate: e.hourly_rate })
  }
  return [...byId.values()]
}
