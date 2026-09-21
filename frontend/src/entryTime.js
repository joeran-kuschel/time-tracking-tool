// Converts between stored times (ISO strings) and the date and time inputs of the entry form, in local time.
const pad = (value) => String(value).padStart(2, '0')

export function toDateInput(time) {
  const d = new Date(time)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function toTimeInput(time) {
  const d = new Date(time)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// "2026-09-21" + "08:30" in local time -> ISO string
export function fromInputs(date, time) {
  return new Date(`${date}T${time}`).toISOString()
}
