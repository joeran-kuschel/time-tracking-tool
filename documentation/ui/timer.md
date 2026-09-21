# Timer

The timer on the Dashboard tracks working time for one project at a time.

## Starting and stopping

1. Select a customer, then a project.
2. Optionally enter a description.
3. Press **Start**. The timer only starts once the backend has saved the entry; if that fails, an error is shown and the
   timer stays stopped.
4. Press **Stop**. If stopping fails, the timer keeps running and shows an error, so you can try again.

The description is saved when the timer starts and kept when it stops. While the timer runs, the field shows the saved
description and can't be edited.

## Running timer across pages and reloads

- The running timer is loaded from the backend (`GET /api/time-entries/active`), not kept in the browser. It keeps
  running when you switch to **Berichte**, reload the page or close the tab.
- The elapsed time is counted from the saved start time, so it is correct after a reload.
- The navigation bar shows the running timer on every page: `Timer läuft: <Projekt> · 00:12:34`
  (English: `Timer running: <project> · 00:12:34`).
- After a reload, the Dashboard selects the customer and project of the running timer.

## Only one timer at a time

- While a timer runs, you can still select other customers and projects and look at their entries. The timer panel
  keeps showing the project that is actually tracked, with its **Stop** button, and explains why the selected project
  can't be started.
- If a timer was started somewhere else, for example in another tab, starting fails with *Es läuft bereits ein Timer.*
  (*A timer is already running.*) and the panel shows that timer.
- Without a selected project, **Start** does nothing and the panel says *Wähle ein Projekt, um den Timer zu starten.*
  (*Select a project to start the timer.*)

## Accessibility

- The description field has a visible label.
- **Start** and **Stop** are the same button element, so keyboard focus stays on it when the timer starts or stops. The
  timer panel is always shown, so focus is never lost when the selected project changes.
- Without a project, **Start** uses `aria-disabled` instead of `disabled`, so it stays focusable, and its description
  points to the hint text.
- Starting and stopping are announced once through a status region (*Timer gestartet für …* / *Timer started for …*,
  *Timer gestoppt* / *Timer stopped*), in the current language. The ticking time itself is not announced.
- Errors are shown with `role="alert"`, so screen readers announce them.
- Start (`green-700`) and Stop (`red-700`) meet WCAG AA contrast with white text.

## Code

- `frontend/src/hooks/useActiveEntry.js`: loads, starts and stops the running timer; used once in `App`
- `frontend/src/hooks/useElapsedTime.js`: elapsed time as `HH:MM:SS`, shared by the navigation bar and the timer
- `frontend/src/components/Timer.jsx`: display only, no API calls
- Tests: `Timer.test.jsx`, `useActiveEntry.test.js`, `useElapsedTime.test.js`, `App.test.jsx`
