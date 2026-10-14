// Runs only the fixture with the timing reporter; used by timingReporter.test.js.
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// cacheDir outside the repo: the run would otherwise leave a node_modules/.vite folder next to the fixture.
export default defineConfig({
  cacheDir: join(tmpdir(), 'vitest-timing-reporter-fixture'),
  test: {
    root: fileURLToPath(new URL('.', import.meta.url)),
    include: ['*.fixture.spec.js'],
    reporters: [fileURLToPath(new URL('../timingReporter.js', import.meta.url))],
  },
})
