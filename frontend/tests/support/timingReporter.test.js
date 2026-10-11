import { describe, expect, it, vi } from 'vitest'
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

describe('TimingReporter', () => {
  it('prints the timing of finished files, including tests in nested suites', () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const reporter = new TimingReporter()
    reporter.onInit()
    reporter.onFinished([{
      name: 'tests/x.test.js',
      result: { duration: 40.4 },
      tasks: [
        { type: 'test', name: 'top', result: { duration: 3.2 } },
        { type: 'suite', name: 'group', tasks: [{ type: 'test', name: 'inner', result: { duration: 7 } }] },
        { type: 'test', name: 'skipped' },
      ],
    }])
    const out = write.mock.calls[0][0]
    write.mockRestore()
    expect(out).toContain('40 ms  tests/x.test.js')
    expect(out).toContain('7 ms  tests/x.test.js > group > inner')
    expect(out).toContain('for 3 tests in 1 files')
  })
})
