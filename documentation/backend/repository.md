# Repository setup

What the repository contains for contributors and for the public GitHub page.

## Continuous integration

`.github/workflows/test.yml` runs the `Tests` workflow on every push to `main` and on every pull request. One job with a
matrix runs for each package (`backend`, `frontend`) in parallel: `npm ci`, then `npm test` on Node 22. The workflow only has read
access to the repository (`permissions: contents: read`). A failing job fails the check.

## Branch protection

The ruleset "Protect main" on GitHub protects `main`: changes arrive only through a pull request, the checks
`backend tests` and `frontend tests` of the `Tests` workflow have to pass, and `main` cannot be force-pushed or deleted.
A pull request needs no approving review (the maintainer is the only one), and the branch does not have to be up to
date with `main` before it is merged. The maintainer's Admin role can bypass the ruleset; the working rules still say
to use pull requests (`CLAUDE.md`). The ruleset allows merge, squash and rebase; the habit is a merge commit
(`gh pr merge --merge`). The repository setting "Delete branch on merge" is on, so GitHub deletes the branch afterwards.
A pull request names the issue it implements with `Closes #<number>`.

## Dependency updates

`.github/dependabot.yml` has Dependabot check once a week for new versions of the backend packages, the frontend
packages and the GitHub Actions in the workflow. Minor and patch updates of one entry (backend, frontend, Actions)
come as a single pull request; the `Tests` workflow runs on it like on any other.

Major updates arrive as separate pull requests and may fail the tests. A minor update of a 0.x package (like
`vitest-axe`) can be breaking too. Major updates of `@babel/plugin-transform-modules-commonjs` in the backend are
ignored, because Jest runs on Babel 7.

Version updates need no setting. Dependabot alerts and security updates are switched on in the repository's security
settings; the file does not enable them.

## Templates

- `.github/ISSUE_TEMPLATE/`: bug report and feature request. Blank issues are off; the contact link sends
  vulnerabilities to GitHub's private reporting.
- `.github/pull_request_template.md`: the checklist from `CONTRIBUTING.md` (tests, documentation, changelog,
  translations, accessibility).

## Community files

- `CONTRIBUTING.md`: setup and the rules for changes.
- `CODE_OF_CONDUCT.md`: the Contributor Covenant 2.1; reports go to the maintainer's email address in the file.
- `SECURITY.md`: how to report a vulnerability, and what the login does and does not protect. Private vulnerability
  reporting has to be switched on in the repository's security settings, or the report link shows a 404.
- `LICENSE`: MIT.

## Test

`backend/tests/github-config.test.js` checks that the workflow is valid YAML, runs both test suites with `npm ci`, has
read-only permissions and uses Node 22 or newer; that the issue templates have a name and a label; that Dependabot
covers both packages and the workflow; that the files named above exist; that the check names the ruleset requires (`backend tests`, `frontend tests`) are the ones
the workflow produces; that the Code of Conduct names a contact and is
linked from `README.md` and `CONTRIBUTING.md`; and that relative links in `README.md`, `CONTRIBUTING.md`,
`CODE_OF_CONDUCT.md`, `SECURITY.md` and the pull request template point to existing files.

`backend/tests/documentation.test.js` checks that every chapter under `documentation/ui/` and `documentation/backend/` is linked
once from `documentation/README.md`, that every link there points to an existing file, and that the `documentation/…md`
paths named in `CLAUDE.md` exist.
