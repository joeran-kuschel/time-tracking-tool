import { useEffect, useRef } from 'react'

// A checkbox that selects an entry, or all entries of a list (indeterminate: some of them are selected). label is its
// accessible name, as the visible label would be.
function SelectCheckbox({ label, checked, indeterminate = false, onChange }) {
  const box = useRef(null)
  useEffect(() => {
    if (box.current) box.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <input
      ref={box}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-6 w-6 shrink-0 accent-accent"
    />
  )
}

export default SelectCheckbox
