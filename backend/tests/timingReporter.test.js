const TimingReporter = require('./helpers/timingReporter')

const { formatTimings } = TimingReporter

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

  it('orders tests by duration', () => {
    const text = formatTimings(files, 120)
    expect(text.indexOf('slow')).toBeLessThan(text.indexOf('medium'))
    expect(text.indexOf('medium')).toBeLessThan(text.indexOf('fast'))
  })
})

describe('TimingReporter', () => {
  it('prints the timing of a finished run to stderr', () => {
    const write = jest.spyOn(process.stderr, 'write').mockImplementation(() => true)
    new TimingReporter().onRunComplete([], {
      startTime: Date.now() - 50,
      testResults: [{
        testFilePath: `${process.cwd()}/tests/x.test.js`,
        perfStats: { start: 100, end: 140 },
        testResults: [{ fullName: 'does x', duration: 12.4 }, { fullName: 'skipped', duration: null }],
      }],
    })
    const out = write.mock.calls[0][0]
    write.mockRestore()
    expect(out).toContain('40 ms  tests/x.test.js')
    expect(out).toContain('12 ms  tests/x.test.js > does x')
    expect(out).toContain('for 2 tests in 1 files')
  })
})
