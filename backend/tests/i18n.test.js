const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { formatter } = require('@lingui/format-po');
const { i18n } = require('@lingui/core');
const { activateLocale } = require('../src/i18n');

const backendDir = path.join(__dirname, '..');
const localesDir = path.join(backendDir, 'src', 'locales');

function readCatalog(file, locale) {
  return formatter().parse(fs.readFileSync(file, 'utf8'), { locale, sourceLocale: 'en', filename: file });
}

const catalogs = {
  en: readCatalog(path.join(localesDir, 'en', 'messages.po'), 'en'),
  de: readCatalog(path.join(localesDir, 'de', 'messages.po'), 'de'),
};

describe('activateLocale', () => {
  test('activates a supported language', () => {
    expect(activateLocale('en')).toBe('en');
    expect(i18n._({ id: 'report.title', message: 'TIME REPORT' })).toBe('TIME REPORT');
  });

  test('falls back to German for missing or unknown languages', () => {
    expect(activateLocale(undefined)).toBe('de');
    expect(activateLocale('fr')).toBe('de');
    expect(i18n._({ id: 'report.title', message: 'TIME REPORT' })).toBe('ZEITABRECHNUNG');
  });

  test('fills in placeholders', () => {
    activateLocale('de');
    expect(i18n._({ id: 'report.customer', message: 'Customer: {customerName}' }, { customerName: 'Muster' }))
      .toBe('Kunde: Muster');
  });
});

describe('translation catalogs', () => {
  test('every message has a German translation', () => {
    const missing = Object.entries(catalogs.de).filter(([, m]) => !m.translation).map(([id]) => id);
    expect(missing).toEqual([]);
  });

  test('German keeps the placeholders of the English message', () => {
    const placeholders = (text) => (text.match(/\{\w+\}/g) || []).sort();
    for (const [id, message] of Object.entries(catalogs.de)) {
      expect(placeholders(message.translation)).toEqual(placeholders(catalogs.en[id].translation));
    }
  });

  test('the catalogs contain exactly the messages in the code (run "npm run extract" otherwise)', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lingui-'));
    const config = path.join(outDir, 'lingui.config.js');
    fs.writeFileSync(config, `module.exports = ${JSON.stringify({
      rootDir: backendDir,
      sourceLocale: 'en',
      locales: ['en'],
      catalogs: [{ path: path.join(outDir, '{locale}'), include: ['<rootDir>/src'] }],
    })}`);

    const result = spawnSync('npx', ['lingui', 'extract', '--config', config, '--workers', '1'], { cwd: backendDir, encoding: 'utf8' });
    expect(result.status).toBe(0);

    const extracted = Object.keys(readCatalog(path.join(outDir, 'en.po'), 'en')).sort();
    expect(Object.keys(catalogs.en).sort()).toEqual(extracted);
    expect(Object.keys(catalogs.de).sort()).toEqual(extracted);
    fs.rmSync(outDir, { recursive: true, force: true });
  }, 30000);
});
