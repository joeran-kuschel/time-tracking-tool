// The groups of the Settings page and the options in them, in the order they are shown. The page is built from this
// list and shows a group only when it has options. A new option also needs an entry in the backend's
// config/settingsOptions.js and a migration.
//
//   { id: 'billing', label: msg`Time and billing`, options: [ ... ] }
//
// An option is { name, type, label, hint } where `name` is its key in /api/settings, `label` and the optional `hint`
// (shown under the field) are msg descriptors, and `type` is one of:
//   'checkbox'  a boolean
//   'select'    one of `choices`: [{ value, label }] (label a msg descriptor)
import { msg } from '@lingui/core/macro'

export const settingsGroups = [
  {
    id: 'billing',
    label: msg`Time and billing`,
    options: [
      {
        name: 'showAmounts',
        type: 'checkbox',
        label: msg`Show hourly rate and amounts in reports`,
        hint: msg`The Reports page starts with this. You can still change it for a single report.`,
      },
    ],
  },
]
