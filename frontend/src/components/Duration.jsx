import { useLingui } from '@lingui/react/macro'
import { formatDuration, isoDuration } from '../format'

// A duration as "3:59 h". <time datetime="PT3H59M"> tells assistive technology it is a length of time, not a time of day.
function Duration({ minutes }) {
  const { i18n } = useLingui()
  const iso = isoDuration(minutes)
  const text = formatDuration(i18n, minutes)
  return iso ? <time dateTime={iso}>{text}</time> : <>{text}</>
}

export default Duration
