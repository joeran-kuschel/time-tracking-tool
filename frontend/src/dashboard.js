import { hoursBetween } from './format'
import { inMonth, projectsOf, summarize } from './summary'

// Calculations for the dashboard, all in local time. Running entries (no end_time) count 0 hours.
// Entries come from GET /api/dashboard and carry project_name, hourly_rate, customer_id and customer_name.

const DAY = 24 * 60 * 60 * 1000

const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const firstOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
const isWeekday = (date) => date.getDay() !== 0 && date.getDay() !== 6

const sumHours = (entries) => entries.reduce((sum, e) => sum + hoursBetween(e.start_time, e.end_time), 0)
const startsIn = (from, to) => (entry) => {
  const start = new Date(entry.start_time)
  return start >= from && start < to
}

// Monday 00:00 of the date's week
export function startOfWeek(date) {
  return addDays(date, -((date.getDay() + 6) % 7))
}

// ISO 8601 week number: week 1 is the week with the year's first Thursday
export function isoWeek(date) {
  const thursday = addDays(startOfWeek(date), 3)
  const firstThursday = addDays(startOfWeek(new Date(thursday.getFullYear(), 0, 4)), 3)
  return Math.round((thursday - firstThursday) / (7 * DAY)) + 1
}

// The entries to load for a date: its month and its week, which can reach into the month before or after
export function dashboardRange(now) {
  const monthStart = firstOfMonth(now)
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const weekStart = startOfWeek(now)
  const weekEnd = addDays(weekStart, 7)
  return { from: weekStart < monthStart ? weekStart : monthStart, to: weekEnd > nextMonth ? weekEnd : nextMonth }
}

// Hours of the current week (Monday to Sunday)
export function weekHours(entries, now) {
  const from = startOfWeek(now)
  return sumHours(entries.filter(startsIn(from, addDays(from, 7))))
}

export function monthEntries(entries, now) {
  return entries.filter((e) => inMonth(e, now))
}

// Monday to Friday of the month, up to and including today
export function workingDaysSoFar(now) {
  let count = 0
  for (let day = firstOfMonth(now); day <= now; day = addDays(day, 1)) {
    if (isWeekday(day)) count++
  }
  return count
}

// One row per day of the month: { date, hours }
export function dailyHours(entries, now) {
  const month = monthEntries(entries, now)
  return Array.from({ length: daysInMonth(now) }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), i + 1)
    return { date, hours: sumHours(month.filter(startsIn(date, addDays(date, 1)))) }
  })
}

// One row per calendar week touching the month, counting only the month's days:
// { week, start, end } with start and end clipped to the month, and hours
export function weeklyHours(entries, now) {
  const days = dailyHours(entries, now)
  const weeks = []
  for (const { date, hours } of days) {
    const last = weeks[weeks.length - 1]
    if (last && date.getDay() !== 1) {
      last.end = date
      last.hours += hours
    } else {
      weeks.push({ week: isoWeek(date), start: date, end: date, hours })
    }
  }
  return weeks
}

// Hours and amounts of the month per customer, most hours first:
// { customerId, name, hours, amount, rates (distinct hourly rates), projects: [{ project, hours, amount }] }
export function byCustomer(entries) {
  const groups = new Map()
  for (const e of entries.filter((entry) => entry.end_time)) {
    if (!groups.has(e.customer_id)) groups.set(e.customer_id, { name: e.customer_name, entries: [] })
    groups.get(e.customer_id).entries.push(e)
  }
  return [...groups.entries()]
    .map(([customerId, { name, entries: own }]) => {
      const summary = summarize(own, projectsOf(own))
      const rates = [...new Set(summary.projects.map((p) => Number(p.project.hourly_rate ?? 0)))].sort((a, b) => a - b)
      return { customerId, name, hours: summary.hours, amount: summary.amount, rates, projects: summary.projects }
    })
    .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name))
}
