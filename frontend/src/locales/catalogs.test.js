// @vitest-environment node
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import { describe, expect, test } from 'vitest'
import { formatter } from '@lingui/format-po'

const frontendDir = path.resolve(__dirname, '..', '..')
const po = formatter()

function readCatalog(file, locale) {
  return po.parse(fs.readFileSync(file, 'utf8'), { locale, sourceLocale: 'en', filename: file })
}

const localesDir = path.join(frontendDir, 'src', 'locales')
const catalogs = {
  en: readCatalog(path.join(localesDir, 'en', 'messages.po'), 'en'),
  de: readCatalog(path.join(localesDir, 'de', 'messages.po'), 'de'),
}

describe('translation catalogs', () => {
  test('every message has a German translation', () => {
    const missing = Object.values(catalogs.de).filter((m) => !m.translation).map((m) => m.message)
    expect(missing).toEqual([])
  })

  test('German keeps the placeholders of the English message', () => {
    for (const [id, message] of Object.entries(catalogs.de)) {
      const placeholders = (text) => (text.match(/\{\w+\}/g) || []).sort()
      expect(placeholders(message.translation), id).toEqual(placeholders(catalogs.en[id].message))
    }
  })

  test('the catalogs contain exactly the messages in the code (run "npm run extract" otherwise)', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lingui-'))
    const config = path.join(outDir, 'lingui.config.cjs')
    fs.writeFileSync(config, `module.exports = ${JSON.stringify({
      rootDir: frontendDir,
      sourceLocale: 'en',
      locales: ['en'],
      catalogs: [{ path: path.join(outDir, '{locale}'), include: ['src'], exclude: ['**/*.test.*', 'src/test/**'] }],
    })}`)

    const result = spawnSync('npx', ['lingui', 'extract', '--config', config, '--workers', '1'], { cwd: frontendDir, encoding: 'utf8' })
    expect(result.status, result.stderr).toBe(0)

    const extracted = readCatalog(path.join(outDir, 'en.po'), 'en')
    expect(Object.keys(catalogs.en).sort()).toEqual(Object.keys(extracted).sort())
    expect(Object.keys(catalogs.de).sort()).toEqual(Object.keys(extracted).sort())
    fs.rmSync(outDir, { recursive: true, force: true })
  }, 30000)
})
