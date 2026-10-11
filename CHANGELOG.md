# Changelog

What changed in the time tracking tool, newest first. Format: [Keep a Changelog](https://keepachangelog.com).
How to write an entry and cut a release: [documentation/backend/changelog.md](documentation/backend/changelog.md).

## [Unreleased]

### Added

- Tooling: every backend and frontend test run ends with a timing report: time per test file, the 10 slowest tests (`TEST_TIMINGS=all` for every test) and the time of the entire run.

### Changed

- Tooling: the frontend tests moved from next to the code into `frontend/tests/`, mirroring `src/`.
- Tooling: the project rules now ask for a changelog entry per change, a test run before every push, cleaning up test data in the real database, a marker for tests that document known bugs, and closing implemented GitHub issues.
