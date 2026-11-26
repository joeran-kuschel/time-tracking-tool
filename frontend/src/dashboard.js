import { minutesBetween } from './format'
import { inMonth, projectsOf, summarize } from './summary'

// Calculations for the dashboard, all in local time. Running entries (no end_time) count 0 minutes.
// Entries come from GET /api/dashboard and carry project_name, hourly_rate, customer_id and customer_name.

const DAY = 24 * 60 * 60 * 1000

export const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const firstOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
const isWeekday = (date) => date.getDay() !== 0 && date.getDay() !== 6

const exactMinutes = (entry) => minutesBetween(entry.start_time, entry.end_time)

// The minutes of the entries as counted by minutesOf: the exact tracked time unless the caller passes another count
// (the chart's billed view passes entryMinutes, the rounded hours of the report)
const sumMinutes = (entries, minutesOf = exactMinutes) => entries.reduce((sum, e) => sum + minutesOf(e), 0)

// The tracked time of the entries in minutes, exact: never the rounded billed hours (running entries count 0)
export const trackedMinutes = (entries) => sumMinutes(entries)
const startsIn = (from, to) => (entry) => {
  const start = new Date(entry.start_time)
  return start >= from && start < to
}

// The first day of the week is a weekday number as in Date.getDay(): 1 for Monday (the default), 0 for Sunday.
// 00:00 of the first day of the date's week
export function startOfWeek(date, firstDay = 1) {
  return addDays(date, -((date.getDay() - firstDay + 7) % 7))
}

// ISO 8601 week number: week 1 is the week with the year's first Thursday (ISO weeks start on Monday)
export function isoWeek(date) {
  const thursday = addDays(startOfWeek(date), 3)
  const firstThursday = addDays(startOfWeek(new Date(thursday.getFullYear(), 0, 4)), 3)
  return Math.round((thursday - firstThursday) / (7 * DAY)) + 1
}

// The number shown for a week: the ISO week that holds most of its days. For a week from Monday that is its own ISO
// week; a week from Sunday gets the number of the ISO week of its Monday, which holds six of its seven days.
export function weekNumber(date, firstDay = 1) {
  const start = startOfWeek(date, firstDay)
  return isoWeek(firstDay === 1 ? start : addDays(start, 1))
}

// The entries to load for a date: its month and its week, which can reach into the month before or after.
// The range fits a week from Monday as well as one from Sunday, so the setting can change without loading again.
export function dashboardRange(now) {
  const monthStart = firstOfMonth(now)
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const weekStarts = [startOfWeek(now, 1), startOfWeek(now, 0)]
  const from = new Date(Math.min(monthStart, ...weekStarts))
  const to = new Date(Math.max(nextMonth, ...weekStarts.map((start) => addDays(start, 7))))
  return { from, to }
}

// Minutes of the current week (seven days from the first day)
export function weekMinutes(entries, now, firstDay = 1) {
  const from = startOfWeek(now, firstDay)
  return sumMinutes(entries.filter(startsIn(from, addDays(from, 7))))
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

// One row per day of the month: { date, minutes }. The minutes are the exact tracked time, or those of minutesOf.
export function dailyMinutes(entries, now, minutesOf) {
  const month = monthEntries(entries, now)
  return Array.from({ length: daysInMonth(now) }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), i + 1)
    return { date, minutes: sumMinutes(month.filter(startsIn(date, addDays(date, 1))), minutesOf) }
  })
}

// One row per calendar week touching the month, counting only the month's days:
// { week, start, end } with start and end clipped to the month, and minutes (counted like dailyMinutes does)
export function weeklyMinutes(entries, now, firstDay = 1, minutesOf) {
  const days = dailyMinutes(entries, now, minutesOf)
  const weeks = []
  for (const { date, minutes } of days) {
    const last = weeks[weeks.length - 1]
    if (last && date.getDay() !== firstDay) {
      last.end = date
      last.minutes += minutes
    } else {
      weeks.push({ week: weekNumber(date, firstDay), start: date, end: date, minutes })
    }
  }
  return weeks
}

// Minutes and amounts of the month per customer, most minutes first:
// { customerId, name, minutes, amount, rates (distinct hourly rates), projects: [{ project, minutes, amount }] }
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
      return { customerId, name, minutes: summary.minutes, amount: summary.amount, rates, projects: summary.projects }
    })
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name))
}
