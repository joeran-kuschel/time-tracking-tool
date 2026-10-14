import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TimingReporter, { formatTimings } from './timingReporter'

const files = [
  { name: 'tests/a.test.js', ms: 30, tests: [{ name: 'fast', ms: 1 }, { name: 'slow', ms: 20 }] },
  { name: 'tests/b.test.js', ms: 50, tests: [{ name: 'medium', ms: 5 }] },
]

describe('formatTimings', () => {
  it('lists the files slowest first and reports the entire run', () => {
    const text = formatTimings(files, 120)
    expect(text.indexOf('tests/b.test.js')).toBeLessThan(text.indexOf('tests/a.test.js'))
    expect(text).toContain('Entire run: 120 ms for 3 tests in 2 files')
  })

  it('shows only the slowest tests unless all are asked for', () => {
    const many = [{ name: 'f', ms: 1, tests: Array.from({ length: 12 }, (_, i) => ({ name: `t${i}`, ms: i })) }]
    expect(formatTimings(many, 10)).not.toContain('f > t0')
    expect(formatTimings(many, 10, true)).toContain('f > t0')
  })
})

// Runs the reporter through a real Vitest run of a fixture, so a Vitest upgrade that changes the reporter API fails here.
describe('TimingReporter', () => {
  const config = join(import.meta.dirname, 'fixtures/vitest.config.js')
  const vitest = join(import.meta.dirname, '../../node_modules/vitest/vitest.mjs')
  const run = (env = {}) => spawnSync(process.execPath, [vitest, 'run', '--config', config], {
    encoding: 'utf8',
    timeout: 50_000, // a hung child fails with status null instead of blocking
    env: { ...process.env, ...env, NODE_OPTIONS: '--no-experimental-webstorage' },
  })

  it('prints the report at the end of a run, with nested suites, a skipped and a failed test', () => {
    const result = run({ TEST_TIMINGS: '' })
    expect(result.error).toBeUndefined() // e.g. a spawn timeout
    expect(result.status).toBe(1) // the fixture has a failing test
    expect(result.stderr).toMatch(/\d+ ms {2}timing\.fixture\.spec\.js\n/)
    expect(result.stderr).toContain('Slowest 10 tests:')
    expect(result.stderr).toMatch(/\d+ ms {2}timing\.fixture\.spec\.js > top level\n/)
    expect(result.stderr).toMatch(/\d+ ms {2}timing\.fixture\.spec\.js > group > inner group > nested\n/)
    expect(result.stderr).toMatch(/\d+ ms {2}timing\.fixture\.spec\.js > group > skipped\n/)
    expect(result.stderr).toMatch(/\d+ ms {2}timing\.fixture\.spec\.js > group > fails\n/)
    expect(result.stderr).toMatch(/Entire run: \d+ ms for 4 tests in 1 files/)
  }, 60_000)

  it('lists every test with TEST_TIMINGS=all', () => {
    const result = run({ TEST_TIMINGS: 'all' })
    expect(result.stderr).toContain('All tests, slowest first:')
    expect(result.stderr).not.toContain('Slowest 10 tests:')
  }, 60_000)
})

// Watch mode calls onTestRunEnd once per rerun; running a real watcher would be slow and flaky, so the hooks are called directly.
describe('TimingReporter in watch mode', () => {
  const module = (name, duration) => ({
    relativeModuleId: name,
    diagnostic: () => ({ duration }),
    children: { allTests: () => [{ fullName: 'a test', diagnostic: () => ({ duration }) }] },
  })
  let write

  beforeEach(() => {
    vi.useFakeTimers()
    write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })
  afterEach(() => {
    write.mockRestore()
    vi.useRealTimers()
  })

  it('measures the entire run of each rerun from its own start and reports only the rerun files', () => {
    const reporter = new TimingReporter()
    reporter.onTestRunStart()
    vi.advanceTimersByTime(500)
    reporter.onTestRunEnd([module('a.test.js', 10), module('b.test.js', 20)])
    vi.advanceTimersByTime(60_000) // idle time in watch mode must not count
    reporter.onTestRunStart()
    vi.advanceTimersByTime(30)
    reporter.onTestRunEnd([module('b.test.js', 20.6)])

    expect(write.mock.calls[0][0]).toContain('Entire run: 500 ms for 2 tests in 2 files')
    expect(write.mock.calls[1][0]).toContain('Entire run: 30 ms for 1 tests in 1 files')
    expect(write.mock.calls[1][0]).toContain('21 ms  b.test.js')
    expect(write.mock.calls[1][0]).not.toContain('a.test.js')
  })

  it('treats a module without timings (not run, collection error) as 0 ms', () => {
    const reporter = new TimingReporter()
    reporter.onTestRunStart()
    reporter.onTestRunEnd([{ relativeModuleId: 'broken.test.js', diagnostic: () => undefined, children: { allTests: () => [] } }])
    expect(write.mock.calls[0][0]).toContain('0 ms  broken.test.js')
  })
})
