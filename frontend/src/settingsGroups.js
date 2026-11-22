// The groups of the Settings page and the options in them, in the order they are shown. The page is built from this
// list and shows a group only when it has options. A new option also needs an entry in the backend's
// config/settingsOptions.js and a migration.
//
//   { id: 'billing', label: msg`Time and billing`, options: [ ... ] }
//
// A group can have a `note` (a msg descriptor), shown below its options.
//
// An option is { name, type, label, hint } where `name` is its key in /api/settings, `label` and the optional `hint`
// (shown under the field) are msg descriptors, and `type` is one of:
//   'checkbox'  a boolean
//   'select'    one of `choices`: [{ value, label }] (value a string or a number, label a msg descriptor)
//   'text'      one line of text; 'textarea' several lines; 'email' an email address (format checked when saving).
//               The value is a text, or null when empty; the page trims it. Options can set `maxLength` (what the field
//               accepts), `maxLines` (textarea) and `autoComplete` (the token that says what the field is)
//   'decimal'   an amount with up to two decimals, typed in the format of the active language ("80,00" / "80.00");
//               its value is a number, or null when empty. The page shows an error for anything else and does not save it
// `disabledWhen(values)` (optional) tells from the current values of the form whether the field is disabled, and
// `disabledHint` (a msg descriptor) says why; it replaces the hint while the field is disabled.
import { msg } from '@lingui/core/macro'

// The option types that are typed text (a 'decimal' is typed text too, but is read as an amount)
export const textTypes = ['text', 'email', 'textarea']

export const settingsGroups = [
  {
    id: 'billing',
    label: msg`Time and billing`,
    note: msg`Rounding also applies to the reports of past months. PDF and CSV files you have already downloaded do not change.`,
    options: [
      {
        name: 'showAmounts',
        type: 'checkbox',
        label: msg`Show hourly rate and amounts in reports`,
        hint: msg`The Reports page starts with this. You can still change it for a single report.`,
      },
      {
        name: 'defaultHourlyRate',
        type: 'decimal',
        label: msg`Default hourly rate for new projects (€)`,
        hint: msg`New projects start with this rate, which you can change for each project. Leave it empty for no default. Existing projects and reports do not change.`,
      },
      {
        name: 'roundingMinutes',
        type: 'select',
        label: msg`Round time entries`,
        hint: msg`Each entry is rounded on its own in reports. The stored times never change. A customer can have its own rule.`,
        choices: [
          { value: 0, label: msg`No rounding` },
          { value: 5, label: msg`5 minutes` },
          { value: 10, label: msg`10 minutes` },
          { value: 15, label: msg`Quarter hour (15 minutes)` },
          { value: 30, label: msg`Half hour (30 minutes)` },
          { value: 60, label: msg`Hour (60 minutes)` },
        ],
      },
      {
        name: 'roundingDirection',
        type: 'select',
        label: msg`Direction`,
        choices: [
          { value: 'up', label: msg`Up` },
          { value: 'nearest', label: msg`To the nearest` },
        ],
        disabledWhen: (values) => !values.roundingMinutes,
        disabledHint: msg`Choose a step in "Round time entries" to set the direction.`,
      },
      {
        name: 'showRoundingNote',
        type: 'checkbox',
        label: msg`Name the rounding rule in reports`,
        hint: msg`Adds a sentence such as "Hours rounded up to quarter hours." to the Reports page and the PDF.`,
        disabledWhen: (values) => !values.roundingMinutes,
        disabledHint: msg`Choose a step in "Round time entries" first.`,
      },
    ],
  },
  {
    id: 'calendar',
    label: msg`Calendar`,
    options: [
      {
        name: 'weekStart',
        type: 'select',
        label: msg`First day of the week`,
        hint: msg`The Dashboard and the period choices This week and Last week on the Entries page start their weeks on this day. Months and reports stay calendar months.`,
        choices: [
          { value: 'monday', label: msg`Monday` },
          { value: 'sunday', label: msg`Sunday` },
        ],
      },
    ],
  },
  {
    id: 'details',
    label: msg`Your details`,
    note: msg`Printed at the top right of the PDF report. Leave them empty for a report without a sender block. The CSV does not change.`,
    options: [
      {
        name: 'senderName',
        type: 'text',
        label: msg`Your name or business name`,
        maxLength: 100,
        autoComplete: 'name',
      },
      {
        name: 'senderAddress',
        type: 'textarea',
        label: msg`Address`,
        hint: msg`Up to 6 lines, for example street and town.`,
        maxLength: 300,
        maxLines: 6,
        autoComplete: 'street-address',
      },
      {
        name: 'senderEmail',
        type: 'email',
        label: msg`Email address`,
        maxLength: 254,
        autoComplete: 'email',
      },
    ],
  },
]
