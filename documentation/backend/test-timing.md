# Test timing

Every test run ends with a timing report, for the backend (Jest) and the frontend (Vitest). It is printed to stderr
after the normal results:

- **Per file:** how long each test file took, slowest first.
- **Slowest 10 tests:** file and test name with the time in ms. `TEST_TIMINGS=all` lists every test instead.
- **Entire run:** the wall-clock time of the whole run, with the number of tests and files.

```bash
cd backend && npm test
cd frontend && npm test
cd backend && TEST_TIMINGS=all npm test   # every test, slowest first
```

Use it to spot tests that get slow, and to compare the time of the full suite before a merge. With a single test file
the report shows only that file.

## Code

- Backend: `backend/tests/helpers/timingReporter.js`, registered under `jest.reporters` in `backend/package.json`.
- Frontend: `frontend/tests/support/timingReporter.js`, registered under `test.reporters` in `frontend/vite.config.js`.
- Tests: `backend/tests/timingReporter.test.js`, `frontend/tests/support/timingReporter.test.js`.

`formatTimings` exists in both reporters, because the backend runs CommonJS and the frontend ES modules; change the
report format in both.

The numbers come from the runners (`perfStats` and `duration`); a skipped test counts as 0 ms.
