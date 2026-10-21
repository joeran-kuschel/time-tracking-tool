# Translation (backend)

The backend translates the PDF report and the column titles of the CSV export. It uses LinguiJS 6 with gettext `.po`
catalogs, like the frontend ([Languages](../ui/languages.md)).

## How it works

- Catalogs: `backend/src/locales/en/messages.po` (source) and `backend/src/locales/de/messages.po`.
- Messages use fixed ids, because the backend has no build step for Lingui's macros:
  `i18n._({ id: 'report.title', message: 'TIME REPORT' })`. `i18n` must be imported from `@lingui/core`, otherwise
  `lingui extract` doesn't find the message.
- `backend/src/i18n.js` reads the `.po` files at startup and compiles them with Lingui's own parser and compiler.
- The `i18n` instance is shared by all requests. `activateLocale(locale)` switches it, and all texts of one PDF are
  translated synchronously right after that, so two requests in different languages can't mix. Keep new
  translations synchronous as well.
- Supported: `en`, `de`. Missing or unknown languages fall back to `de`.
- Dates and numbers use Lingui's `i18n.date` and `i18n.number` (Intl), e.g. `2.3.2026` / `1,50 h` in German and
  `3/2/2026` / `1.50 h` in English.

## Adding a text

1. Add `i18n._({ id: 'area.name', message: 'English text' })` in the code.
2. Run `npm run extract` in `backend/`.
3. Fill in the German `msgstr` in `src/locales/de/messages.po`.

`tests/i18n.test.js` fails if a message is not extracted, a German translation is missing or a placeholder like
`{customerName}` got lost in the translation.
