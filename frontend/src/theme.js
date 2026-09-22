// Light or dark theme. The choice is 'light', 'dark' or 'system' (follow the operating system) and is remembered
// like the language. applyTheme() sets data-theme on <html>, which switches the colors in index.css.
export const THEMES = ['light', 'dark', 'system']
const STORAGE_KEY = 'theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

export function storedTheme() {
  let stored = null
  try {
    stored = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // storage can be blocked, e.g. in private windows
  }
  return THEMES.includes(stored) ? stored : 'system'
}

export function systemPrefersDark() {
  return Boolean(window.matchMedia?.(DARK_QUERY).matches)
}

export function applyTheme(choice) {
  const dark = choice === 'dark' || (choice === 'system' && systemPrefersDark())
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

export function saveTheme(choice) {
  applyTheme(choice)
  try {
    window.localStorage.setItem(STORAGE_KEY, choice)
  } catch {
    // the switch still works for this visit
  }
}

// Calls onChange when the operating system switches between light and dark; returns a function to stop
export function watchSystemTheme(onChange) {
  const query = window.matchMedia?.(DARK_QUERY)
  if (!query) return () => {}
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
