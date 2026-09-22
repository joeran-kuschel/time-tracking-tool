# Dashboard

The Dashboard is the start page. It has three panels (customers, projects, timer) and below them the entries of the
selected customer, grouped by project. On narrow screens the panels are stacked.

## Customers

- Lists all customers, sorted by name. Selecting one shows its projects; the selected one is marked with
  `aria-pressed`.
- The pencil icon (**Edit**) opens a form in place with name and email; **Save**, **Cancel** or Escape close it.
- The trash icon (**Delete**) asks in place first (*Delete Muster GmbH and all its projects and time entries?*). This can't be undone.
  While the running timer belongs to the customer, deleting fails with *Stop the running timer first.*
- **New customer** next to the heading opens a dialog with name and optional email. The new customer is added to the
  list but not selected.

## Projects

- Shows the projects of the selected customer, sorted by name, each with its hourly rate, for example `80,00 €/h`
  in German and `€80.00/h` in English.
- Selecting a customer selects no project, so the entries below show all its projects. Only the project of a running
  timer is selected, e.g. after a reload, so **Stop** sits next to the right project.
- Selecting a project narrows the entries to it and lets the timer start for it. Selecting it again deselects it and
  shows all projects again. After adding, editing or deleting a project, the selection stays if the project still
  exists.
- **Edit** (name, hourly rate) and **Delete** (with its time entries) work like for customers.
- **New project** next to the heading (shown once a customer is selected) opens a dialog with name and hourly rate.
  The new project is added but not selected.

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
- The delete confirmation starts on **Cancel**, the safe choice. After deleting, focus moves to the list.
- Renaming a customer or project keeps it selected and shows the new name right away.

## Timer

See [Timer](timer.md).

## Entries

- Shown once a customer is selected. The heading reads *Entries for Muster GmbH*, or *Entries for Website* while a
  project is selected.
- Entries are grouped by project, in the order of the project list; projects without entries are left out. Each group
  has a heading with the project name and its total hours (*Website · 12,50 h gesamt*) and its own table (named by
  that heading): start, end, hours and description, newest first. A running entry counts `0` hours in the total, as
  in its row.
- With a project selected, only its group is shown.
- A running entry shows **Active** as its end and `0,00 h` / `0.00 h`. It appears as soon as the timer starts. It can't
  be edited or deleted; stop the timer first.
- Dates and hours follow the language, for example `21.09.2026, 11:52` and `1,50 h` in German, `09/21/2026, 11:52 AM`
  and `1.50 h` in English.

### Adding time manually

**Add time** (*Zeit nachtragen*) opens a dialog: project, date, start, end and an optional description. The date starts
as today, the project as the selected one, or the first project when none is selected. The button is hidden while the
customer has no projects. The end must be after the start, so an entry can't cross midnight;
otherwise the form says *End must be after start.* next to the end field. Overlapping entries are allowed.

### Editing and deleting entries

- **Edit** turns a finished entry's row into the same form, filled with its values. The project dropdown offers the
  projects of the same customer, so an entry booked on the wrong project can be moved.
- An entry the timer recorded past midnight keeps its day offset; its end field then reads *End (next day)*.
- **Delete** asks *Delete the entry from 21.09.2026, 10:00?* first.

## Errors

Loading or saving failures are shown next to the panel they belong to. See [Error messages](error-messages.md).

## Code

- `frontend/src/pages/Dashboard.jsx`: selection (kept as ids), loading and saving
- `components/EditableList.jsx`: the customer and project lists
- `components/RecordForm.jsx`: forms with visible labels, for creating and editing
- `components/Modal.jsx`: the add dialogs
- `components/EntryForm.jsx`, `entryTime.js`: the time entry form and its local date/time conversion
- `components/EntriesList.jsx`, `components/ConfirmDelete.jsx`, `hooks/useEditable.js`: editing and deleting in place
- Tests: `App.test.jsx` and a test file next to each component and hook
