import { useLingui } from '@lingui/react/macro'
import { LANGUAGES, switchLocale } from '../i18n'

// Switches the language in place; each button is labeled in its own language
function LanguageSwitcher() {
  const { t, i18n } = useLingui()

  return (
    <div role="group" aria-label={t`Language`} className="flex gap-0.5 rounded-lg bg-paper p-0.5">
      {Object.entries(LANGUAGES).map(([code, name]) => (
        <button
          key={code}
          lang={code}
          aria-pressed={i18n.locale === code}
          onClick={() => switchLocale(code)}
          className={`min-h-[2rem] rounded-md px-2.5 text-sm ${
            i18n.locale === code ? 'bg-surface font-semibold text-ink shadow-xs' : 'text-muted hover:text-ink'
          }`}
        >
          {name}
        </button>
      ))}
    </div>
  )
}

export default LanguageSwitcher
