// Until the amounts checkbox became the setting "Show hourly rate and amounts in reports" (#80), the browser
// remembered the choice under this key. It has no effect any more, so it is removed.
const AMOUNTS_KEY = 'reportAmounts'

export function forgetStoredShowAmounts() {
  try {
    window.localStorage.removeItem(AMOUNTS_KEY)
  } catch {
    // storage can be blocked, e.g. in private windows
  }
}
