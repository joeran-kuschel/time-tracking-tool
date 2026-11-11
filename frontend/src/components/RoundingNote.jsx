import { useLingui } from '@lingui/react/macro'
import { roundingNote } from '../rounding'

// The sentence that names the rounding rule under a card with billing figures, e.g. "Hours rounded up to quarter
// hours.", so the rounded hours there are not mistaken for the tracked time. rounding: { minutes, direction }, or
// null/undefined for no rounding (nothing is shown then).
function RoundingNote({ rounding, className = 'text-sm text-muted' }) {
  const { i18n } = useLingui()
  const note = roundingNote(rounding)
  return note ? <p className={className}>{i18n._(note)}</p> : null
}

export default RoundingNote
