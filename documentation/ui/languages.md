# Languages

The tool is available in German and English. The language can be switched at any time without reloading the page.

## Switching

- The header has two buttons, **Deutsch** and **English**. The active one is highlighted and marked with
  `aria-pressed="true"`.
- Switching changes all texts, dates, numbers and month names in place. Typed text, the selected customer and project,
  and a running timer stay as they are. Error messages that are already shown switch too.
- The choice is stored in the browser (`localStorage`, key `language`). Without a stored choice, German browsers get
  German and all other browsers get English.
- The PDF report is downloaded in the current language.

## Accessibility

- `<html lang>` always matches the current language (WCAG 3.1.1), so screen readers pronounce the texts correctly.
- Each button is labeled in its own language and carries a matching `lang` attribute (WCAG 3.1.2).
- The buttons are grouped as *Sprache* / *Language*.
- Contrast: 6.7:1 for the active and 10.3:1 for the inactive button (measured in the browser).

## How it works

- LinguiJS 5 with gettext `.po` catalogs in `frontend/src/locales/{en,de}/messages.po`. English is the source language
  in the code; German comes from the German catalog.
- Texts in the code use Lingui's macros: `<Trans>…</Trans>` in JSX, `t` from `useLingui()` for attributes, and
  `msg` for messages that are translated later, for example error messages.
- `frontend/src/i18n.js` loads both catalogs, detects the language and switches it. The Lingui Vite plugin compiles
  the `.po` files during the build.
- Dates and numbers use `i18n.date` and `i18n.number`; hours and rates are formatted in `frontend/src/format.js`.

## Adding a text

1. Write it in English with `<Trans>`, `t` or `msg`.
2. Run `npm run extract` in `frontend/`.
3. Fill in the German `msgstr` in `src/locales/de/messages.po`.

`src/locales/catalogs.test.js` fails if a text is not extracted, a German translation is missing or a placeholder like
`{projectName}` got lost in the translation.

## Code

`frontend/src/i18n.js`, `components/LanguageSwitcher.jsx`, `format.js`, `lingui.config.js`. Tests: `i18n.test.js`,
`components/LanguageSwitcher.test.jsx`, `format.test.js`, `locales/catalogs.test.js`, `App.test.jsx`.
