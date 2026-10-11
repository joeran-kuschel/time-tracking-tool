// Jest reporter: how long each test file, the slowest tests and the whole run took.
// TEST_TIMINGS=all lists every test.
const SLOWEST = 10

function formatTimings(files, totalMs, listAll = false) {
  const tests = files.flatMap((file) => file.tests.map((test) => ({ ...test, file: file.name })))
  const shown = tests.slice().sort((a, b) => b.ms - a.ms).slice(0, listAll ? undefined : SLOWEST)
  const lines = ['', 'Test timing', '', 'Per file:']
  files.slice().sort((a, b) => b.ms - a.ms).forEach((file) => lines.push(`  ${file.ms} ms  ${file.name}`))
  lines.push('', listAll ? 'All tests, slowest first:' : `Slowest ${SLOWEST} tests:`)
  shown.forEach((test) => lines.push(`  ${test.ms} ms  ${test.file} > ${test.name}`))
  lines.push('', `Entire run: ${totalMs} ms for ${tests.length} tests in ${files.length} files`, '')
  return lines.join('\n')
}

class TimingReporter {
  onRunComplete(_contexts, results) {
    const files = results.testResults.map((file) => ({
      name: file.testFilePath.replace(`${process.cwd()}/`, ''),
      ms: file.perfStats.end - file.perfStats.start,
      tests: file.testResults.map((test) => ({ name: test.fullName, ms: Math.round(test.duration || 0) })),
    }))
    process.stderr.write(formatTimings(files, Date.now() - results.startTime, process.env.TEST_TIMINGS === 'all'))
  }
}

module.exports = TimingReporter
module.exports.formatTimings = formatTimings
