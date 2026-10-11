# Repository setup

What the repository contains for contributors and for the public GitHub page.

## Continuous integration

`.github/workflows/test.yml` runs the `Tests` workflow on every push to `main` and on every pull request. Two jobs run
in parallel, one per package (`backend`, `frontend`): `npm ci`, then `npm test` on Node 22. The workflow only has read
access to the repository (`permissions: contents: read`). A failing job fails the check.

## Templates

- `.github/ISSUE_TEMPLATE/`: bug report and feature request. Blank issues are off; the contact link sends
  vulnerabilities to GitHub's private reporting.
- `.github/pull_request_template.md`: the checklist from `CONTRIBUTING.md` (tests, documentation, changelog,
  translations, accessibility).

## Community files

- `CONTRIBUTING.md`: setup and the rules for changes.
- `SECURITY.md`: how to report a vulnerability, and the warning that the API has no login.
- `LICENSE`: MIT.

## Test

`backend/tests/github-config.test.js` checks that the workflow is valid YAML, runs both test suites with `npm ci`, has
read-only permissions and uses Node 22 or newer; that the issue templates have a name and a label; and that the files
named above exist.
