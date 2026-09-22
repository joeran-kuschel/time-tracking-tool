# Dashboard

The Dashboard is the start page. Customers are listed in a sidebar. The main area shows the selected customer, its
project filter, the timer, a summary of the current month and the customer's entries, grouped by project. On narrow
screens the sidebar sits above the main area (see [Design](design.md)).

## Customers

- The sidebar lists all customers, sorted by name. Selecting one opens it in the main area; the selected one is marked
  with `aria-pressed`. The customer of the running timer has a red dot, and its button name ends in *, Timer läuft*
  (*, timer running*).
- **+** (*New customer*) next to the heading opens a dialog with name and optional email. The new customer is added to
  the list but not selected.
- The main area shows the customer's name as the page heading (`<h1>`) and its email. Next to it:
  - The pencil icon (**Edit**) replaces the heading with a form (*Edit customer*: name, email); **Save**, **Cancel** or
    Escape close it.
  - The trash icon (**Delete**) asks in place first (*Delete Muster GmbH and all its projects and time entries?*). This
    can't be undone. While the running timer belongs to the customer, deleting fails with *Stop the running timer
    first.* After deleting, focus moves to the customer list.
- Without a selected customer, the main area says *Select a customer* and only shows the timer.

## Projects

- Below the customer name, the projects are a row of toggle buttons (`aria-pressed`), each with its hourly rate, for
  example `80,00 €/h` in German and `€80.00/h` in English. **All projects** comes first.
- Selecting a customer selects no project (**All projects**), so the entries show all its projects. Only the project of
  a running timer is selected, e.g. after a reload, so **Stop** sits next to the right project.
- Selecting a project narrows the entries to it and lets the timer start for it. Selecting it again, or **All
  projects**, shows all projects again. After adding, editing or deleting a project, the selection stays if the
  project still exists.
- **Edit** (name, hourly rate) and **Delete** (with its time entries) appear at the end of the row for the selected
  project and work like for customers. After deleting, focus moves to the project row.
- **New project** (dashed button at the end of the row) opens a dialog with name and hourly rate. The new project is
  added but not selected.

## Month summary

Next to the timer, a card sums up the selected customer's current month (e.g. *September 2026*):

- **Hours this month**, **Billable amount** (hours × hourly rate of each entry's project) and the number of
  **Entries**. Only finished entries count; a running timer is added once it stops.
- One bar per project with its hours, in the order of the projects. Projects without hours this month are left out.
- *No time recorded this month yet.* when there is nothing to sum up.
- **Open report** opens the Reports page for this customer and the current month.

The summary is calculated in the browser from the entries the Dashboard already loaded (`summary.js`), so it needs no
extra request. It always covers all projects, also while one project is selected.

## Add dialogs

Adding a customer, a project or a time entry happens in a modal dialog (native `<dialog>`, `components/Modal.jsx`):

- Opening moves focus to the first field; the page behind it can't be used until the dialog closes.
- **Save** adds the record and closes the dialog. If saving fails, the dialog stays open with the typed values and the
  error.
- **Cancel** or Escape close it and discard the input. Clicking the dimmed background does not close it.
- On closing, focus returns to the button that opened the dialog. Each opening starts with an empty form.

## Editing and deleting in general

- Edit and delete are icon buttons (Heroicons `PencilSquareIcon` and `TrashIcon`, `components/RecordActions.jsx`).
  Their tooltip names the record, e.g. *Edit Muster GmbH*.
- Editing opens a form in place and moves focus to its first field. Closing it returns focus to the button that opened
  it.
- The delete confirmation starts on **Cancel**, the safe choice.
- Renaming a customer or project keeps it selected and shows the new name right away.

## Timer

See [Timer](timer.md).

## Entries

- Shown once a customer is selected. The heading reads *Entries for Muster GmbH*, or *Entries for Website* while a
  project is selected.
- Entries are grouped by project, in the order of the project list; projects without entries are left out. Each group
  has a heading with the project name and its total hours (*Website · 12,50 h gesamt*) and its own table (named by
  that heading): date, time, hours and description, newest first. A running entry counts `0` hours in the total, as
  in its row.
- With a project selected, only its group is shown.
- The date is short with the weekday (`Mo., 21. Sept.` / `Mon, Sep 21`), the time is start and end (`09:00 – 12:30`).
- A running entry has a light red row and shows *läuft* (*running*) as its end and `0,00 h` / `0.00 h`. It appears as
  soon as the timer starts, also when it is started or stopped from the header. It can't be edited or deleted; stop
  the timer first.

### Adding time manually

**Add time** (*Zeit nachtragen*) opens a dialog: project, date, start, end and an optional description. The date starts
as today, the project as the selected one, or the first project when none is selected. The button is hidden while the
customer has no projects. The end must be after the start, so an entry can't cross midnight;
otherwise the form says *End must be after start.* next to the end field. Overlapping entries are allowed.

### Editing and deleting entries

- **Edit** turns a finished entry's row into the same form, filled with its values. The project dropdown offers the
  projects of the same customer, so an entry booked on the wrong project can be moved.
- An entry the timer recorded past midnight keeps its day offset; its end field then reads *End (next day)*.
- **Delete** asks *Delete the entry from 21.09.2026, 10:00?* first. After deleting, focus moves to the entries.

## Errors

Loading or saving failures are shown next to the part they belong to. See [Error messages](error-messages.md).

## Code

- `frontend/src/pages/Dashboard.jsx`: layout, selection (kept as ids), loading and saving
- `components/EditableRecord.jsx`: the selected customer and project, edited or deleted in place
- `components/MonthSummary.jsx`, `summary.js`: the month summary and its calculation
- `components/RecordForm.jsx`: forms with visible labels, for creating and editing
- `components/Modal.jsx`: the add dialogs
- `components/EntryForm.jsx`, `entryTime.js`: the time entry form and its local date/time conversion
- `components/EntriesList.jsx`, `components/ConfirmDelete.jsx`, `hooks/useEditable.js`: editing and deleting in place
- Tests: `App.test.jsx` and a test file next to each component, hook and module
