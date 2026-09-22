import { useEffect, useState } from 'react'
import { ComputerDesktopIcon, MoonIcon, SunIcon } from '@heroicons/react/24/outline'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { applyTheme, saveTheme, storedTheme, watchSystemTheme } from '../theme'

const options = [
  { value: 'light', label: msg`Light`, Icon: SunIcon },
  { value: 'dark', label: msg`Dark`, Icon: MoonIcon },
  { value: 'system', label: msg`Like the system`, Icon: ComputerDesktopIcon },
]

// Switches between light, dark and the system's theme without a reload. The icon buttons are named by their
// title, like the edit and delete buttons (RecordActions).
function ThemeSwitcher() {
  const { t, i18n } = useLingui()
  const [choice, setChoice] = useState(storedTheme)

  // Following the system: switch along when the system does
  useEffect(() => {
    if (choice !== 'system') return undefined
    return watchSystemTheme(() => applyTheme('system'))
  }, [choice])

  const choose = (value) => {
    saveTheme(value)
    setChoice(value)
  }

  return (
    <div role="group" aria-label={t`Theme`} className="flex gap-0.5 rounded-lg bg-paper p-0.5">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          title={i18n._(label)}
          aria-pressed={choice === value}
          onClick={() => choose(value)}
          className={`inline-flex min-h-[2rem] w-8 items-center justify-center rounded-md ${
            choice === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}

export default ThemeSwitcher
