# Changelog

What changed in the time tracking tool, newest first. Format: [Keep a Changelog](https://keepachangelog.com).
How to write an entry and cut a release: [documentation/backend/changelog.md](documentation/backend/changelog.md).

## [Unreleased]

### Added

- Tooling: every backend and frontend test run ends with a timing report: time per test file, the 10 slowest tests (`TEST_TIMINGS=all` for every test) and the time of the entire run.

### Changed

- Tooling: dependencies updated to their latest major versions (React 19, Vite 8, Vitest 5, Tailwind CSS 4, Lingui 6, Express 5, jsdom 30).
- PDF report downloads: file names with accents or other non-ASCII letters now show a plain `?` in the basic file name; the full name stays in the extended `filename*` that browsers use.
- Tooling: GitHub test workflow, issue and pull request templates, `CONTRIBUTING.md` and `SECURITY.md`.
- Tooling: Dependabot checks the dependencies and GitHub Actions weekly.
- The README warns that the API has no login.
- Tooling: the `test-engineer` agent reports test timings: the time of the test files it adds, their slowest tests and, for a full run, the entire-run time.
- Tooling: the frontend tests moved from next to the code into `frontend/tests/`, mirroring `src/`.
- Tooling: the project rules now ask for a changelog entry per change, a test run before every push, cleaning up test data in the real database, a marker for tests that document known bugs, and closing implemented GitHub issues.
