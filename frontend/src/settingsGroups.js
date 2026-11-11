// The groups of the Settings page and the options in them, in the order they are shown. The page is built from this
// list and shows a group only when it has options. Empty until the first option exists (#80).
//
//   { id: 'billing', label: msg`Time and billing`, options: [ ... ] }
//
// An option is { name, type, label, hint } where `name` is its key in /api/settings, `label` and the optional `hint`
// (shown under the field) are msg descriptors, and `type` is one of:
//   'checkbox'  a boolean
//   'select'    one of `choices`: [{ value, label }] (label a msg descriptor)
export const settingsGroups = []
