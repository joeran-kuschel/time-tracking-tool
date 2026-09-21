import { useLingui } from '@lingui/react/macro'
import { LANGUAGES, switchLocale } from '../i18n'

// Switches the language in place; each button is labeled in its own language
function LanguageSwitcher() {
  const { t, i18n } = useLingui()

  return (
    <div role="group" aria-label={t`Language`} className="flex gap-1">
      {Object.entries(LANGUAGES).map(([code, name]) => (
        <button
          key={code}
          lang={code}
          aria-pressed={i18n.locale === code}
          onClick={() => switchLocale(code)}
          className={`px-2 py-1 rounded text-sm border ${
            i18n.locale === code ? 'bg-blue-700 border-blue-700 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
          }`}
        >
          {name}
        </button>
      ))}
    </div>
  )
}

export default LanguageSwitcher
