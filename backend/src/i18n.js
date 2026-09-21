const fs = require('fs');
const path = require('path');
const { i18n } = require('@lingui/core');
const { compileMessage } = require('@lingui/message-utils/compileMessage');
const { formatter } = require('@lingui/format-po');

const LOCALES = ['en', 'de'];
// Reports were German before they could be translated, so German stays the default
const DEFAULT_LOCALE = 'de';

// Reads the .po catalogs at startup, so the backend needs no build step
function loadMessages(locale) {
  const file = path.join(__dirname, 'locales', locale, 'messages.po');
  const catalog = formatter().parse(fs.readFileSync(file, 'utf8'), { locale, sourceLocale: 'en', filename: file });
  return Object.fromEntries(Object.entries(catalog).map(([id, entry]) => [id, entry.translation || entry.message]));
}

i18n.setMessagesCompiler(compileMessage);
i18n.load(Object.fromEntries(LOCALES.map((locale) => [locale, loadMessages(locale)])));

// i18n is shared by all requests: activate the language and translate synchronously right after
function activateLocale(locale) {
  i18n.activate(LOCALES.includes(locale) ? locale : DEFAULT_LOCALE);
  return i18n.locale;
}

module.exports = { activateLocale, LOCALES, DEFAULT_LOCALE };
