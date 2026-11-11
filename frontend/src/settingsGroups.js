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
// `disabledWhen(values)` (optional) tells from the current values of the form whether the field is disabled, and
// `disabledHint` (a msg descriptor) says why; it replaces the hint while the field is disabled.
import { msg } from '@lingui/core/macro'

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
        name: 'roundingMinutes',
        type: 'select',
        label: msg`Round time entries`,
        hint: msg`Each entry is rounded on its own in reports. The stored times never change.`,
        choices: [
          { value: 0, label: msg`No rounding` },
          { value: 15, label: msg`Quarter hour (15 minutes)` },
          { value: 30, label: msg`Half hour (30 minutes)` },
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
]
