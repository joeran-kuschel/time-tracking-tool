# Timer

The timer on the Time tracking page tracks working time for one project at a time.

## Starting and stopping

1. Select a customer, then a project.
2. Optionally enter a description.
3. Press **Start**. The timer only starts once the backend has saved the entry; if that fails, an error is shown and the
   timer stays stopped.
4. Press **Stop**. If stopping fails, the timer keeps running and shows an error, so you can try again.

While a start or stop is being sent, **Start**, **Stop** and the header's Stop button are marked `aria-disabled` and
dimmed, and further clicks do nothing (`busy` in `useActiveEntry`). A double click therefore sends one request, not two.
The backend also refuses a second running timer on its own, see [Time entries API](../backend/time-entries.md#creating-entries).

The description is saved when the timer starts and kept when it stops. While the timer runs, the field shows the saved
description and can't be edited.

## Running timer across pages and reloads

- The running timer is loaded from the backend (`GET /api/time-entries/active`), not kept in the browser. It keeps
  running when you switch to **Berichte**, reload the page or close the tab.
- The elapsed time is counted from the saved start time, so it is correct after a reload.
- The header shows the running timer on every page (*Laufender Timer* / *Running timer*): project, customer, elapsed
  time and its own **Stop** button. Stopping there works on every page; afterwards focus moves to the page content,
  because the button disappears with the timer. On narrow screens the customer is left out.
- The timer panel shows *Läuft seit 10:02* (*Running since 10:02*) while the timer runs.
- After a reload, the Time tracking page selects the customer and project of the running timer.

## Resuming an activity

**Resume** (*Fortsetzen*) on a finished entry on the Time tracking page runs **that entry** on again: its end time is
cleared (`POST /api/time-entries/:id/resume`), so it is the running timer with its project, description and original
start. No new entry is created. **The time between the end of the entry and the resume counts as work time**, so
resume right away, or edit the entry's start/end afterwards, or start a new entry (**Start**) after a longer break.
It is a normal start for the rest (`useActiveEntry.resume`): the header shows the timer, the start is announced once
(*Timer gestartet für …*), a failed resume shows an error (*Timer konnte nicht fortgesetzt werden.*) and no timer runs,
and a double click sends one request.

- The button is a play icon in the actions of an entry row, before **Edit**. Its name is *Fortsetzen: Website, Login
  reparieren* (*Resume: Website, Fix login*), or only the project for an entry without description; its description
  says *Der Eintrag läuft weiter: die Zeit seit seinem Ende zählt als Arbeitszeit.* A running entry has no button.
- While a timer runs or a start is being sent, the button uses `aria-disabled` and does nothing. Its description says
  *Stoppe zuerst den laufenden Timer.* (*Stop the running timer first.*). The backend answers `409` for a second timer.
- After a successful resume on the Time tracking page, focus moves to the panel's **Stop** button, because the row's
  button is then disabled and the list reloads.
- The same button is on the Dashboard's recent entries and on the results of the Entries search
  ([Dashboard](dashboard.md#recent-entries), [Entries](entries.md#results)). There, focus moves to the **Stop timer**
  button in the header, the one timer control that is shown on every page (the Dashboard's timer card can be on another
  tab). The running timer takes the entry's own project and customer. A failed resume shows the timer's error where
  the page shows it (the Dashboard's timer card, or above the Entries page).

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
- Starting and stopping are announced once through one status region in `App`, whether they were triggered in the
  panel or in the header (*Timer gestartet für …* / *Timer started for …*, *Timer gestoppt* / *Timer stopped*), in the
  current language. The ticking time itself is not announced.
- The header's Stop button shows *Stop* and is named *Stop Timer* / *Stop timer* (the second word is visually hidden),
  so it can be told apart from the panel's **Stop**.
- Errors are shown with `role="alert"`, so screen readers announce them.
- Start (`accent`, 7.8:1) and Stop (`danger`, 6.6:1) meet WCAG AA contrast with white text.

## Code

- `frontend/src/hooks/useActiveEntry.js`: loads, starts and stops the running timer and keeps what to announce; used
  once in `App`
- `frontend/src/components/ResumeButton.jsx`: the Resume button and its two descriptions, shared by `EntriesList`, the Dashboard's `RecentEntries` and `EntryResults`; `pages/TimeTracking.jsx` (`resumeEntry`) and `App.jsx` (`resumeFromList`, for the other two pages) start the timer
- `frontend/src/hooks/useElapsedTime.js`: elapsed time as `HH:MM:SS`, shared by the header and the timer panel
- `frontend/src/components/Timer.jsx`: the timer panel, display only, no API calls
- `frontend/src/components/RunningTimer.jsx`: the running timer in the header
- Tests (in `frontend/tests/`): `components/Timer.test.jsx`, `RunningTimer.test.jsx`, `useActiveEntry.test.js`, `useElapsedTime.test.js`, `App.test.jsx`
