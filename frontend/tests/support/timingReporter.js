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

function testsOf(task, prefix = '') {
  const name = prefix ? `${prefix} > ${task.name}` : task.name
  if (task.type === 'test') return [{ name, ms: Math.round(task.result?.duration || 0) }]
  return (task.tasks || []).flatMap((child) => testsOf(child, task.type === 'suite' ? name : prefix))
}

export default class TimingReporter {
  onInit() {
    this.start = Date.now()
  }

  onWatcherRerun() {
    this.start = Date.now()
  }

  onFinished(files = []) {
    const timed = files.map((file) => ({
      name: file.name,
      ms: Math.round(file.result?.duration || 0),
      tests: (file.tasks || []).flatMap((task) => testsOf(task)),
    }))
    process.stderr.write(formatTimings(timed, Date.now() - this.start, process.env.TEST_TIMINGS === 'all'))
  }
}
