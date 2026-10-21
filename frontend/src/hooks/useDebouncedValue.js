import { useEffect, useState } from 'react'

// The value after it stayed the same for delay milliseconds. The second result applies a value at once,
// e.g. on Enter or when a field is cleared.
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return [debounced, setDebounced]
}
