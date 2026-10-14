// Vitest reporter: how long each test file, the slowest tests and the whole run took.
// TEST_TIMINGS=all lists every test.
const SLOWEST = 10

export function formatTimings(files, totalMs, listAll = false) {
  const tests = files.flatMap((file) => file.tests.map((test) => ({ ...test, file: file.name })))
  const shown = tests.slice().sort((a, b) => b.ms - a.ms).slice(0, listAll ? undefined : SLOWEST)
  const lines = ['', 'Test timing', '', 'Per file:']
  files.slice().sort((a, b) => b.ms - a.ms).forEach((file) => lines.push(`  ${file.ms} ms  ${file.name}`))
  lines.push('', listAll ? 'All tests, slowest first:' : `Slowest ${SLOWEST} tests:`)
  shown.forEach((test) => lines.push(`  ${test.ms} ms  ${test.file} > ${test.name}`))
  lines.push('', `Entire run: ${totalMs} ms for ${tests.length} tests in ${files.length} files`, '')
  return lines.join('\n')
}

const ms = (diagnostic) => Math.round(diagnostic?.duration || 0)

export default class TimingReporter {
  onTestRunStart() {
    this.start = Date.now()
  }

  onTestRunEnd(testModules = []) {
    const timed = testModules.map((module) => ({
      name: module.relativeModuleId,
      ms: ms(module.diagnostic()),
      tests: Array.from(module.children.allTests(), (test) => ({ name: test.fullName, ms: ms(test.diagnostic()) })),
    }))
    process.stderr.write(formatTimings(timed, Date.now() - this.start, process.env.TEST_TIMINGS === 'all'))
  }
}
