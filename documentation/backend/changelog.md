# Changelog

`CHANGELOG.md` at the repository root says what changed in the tool, in the
[Keep a Changelog](https://keepachangelog.com) layout. It answers "what did the last release bring in?"

## Layout

- `## [Unreleased]` on top: everything merged since the last release.
- Below it one `## YYYY-MM-DD` section per release, newest first.
- Inside a section the groups **Added**, **Changed**, **Fixed** and **Removed**, in that order; leave out empty ones.

There are no version numbers.

## Writing an entry

- Every feature, fix or removal adds its entry to `Unreleased` **in the same branch**; the `code-reviewer` checks it.
- Write for the user of the tool: "Reports can be sent as PDF", not "Add pdfGenerator". A change to tooling or tests
  is one short line under Changed, starting with "Tooling:".

## Cutting a release

When you release (for example after deploying), rename `## [Unreleased]` to the day's date (`## 2026-10-12`) and put a
fresh empty `## [Unreleased]` with no groups above it. A release with several deploys on one day is one section.

## Test

`backend/tests/changelog.test.js` checks that `Unreleased` comes first, that the dated sections follow newest first,
that the groups use only the four names, once each and in the order above, and that every group has an entry.
