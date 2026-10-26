// Options of the Reports page that the browser remembers. Today the browser is the only source; a per-user default
// from the server (issue #49) would change only storedShowAmounts().
const AMOUNTS_KEY = 'reportAmounts'

// Whether the report shows hourly rates and amounts: off until the box was ticked once
export function storedShowAmounts() {
  try {
    return window.localStorage.getItem(AMOUNTS_KEY) === 'true'
  } catch {
    // storage can be blocked, e.g. in private windows
    return false
  }
}

export function saveShowAmounts(show) {
  try {
    window.localStorage.setItem(AMOUNTS_KEY, String(show))
  } catch {
    // the choice still works for this visit
  }
}
