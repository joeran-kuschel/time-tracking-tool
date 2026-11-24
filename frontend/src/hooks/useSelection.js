import { useCallback, useMemo, useState } from 'react'

// A set of selected ids (entries): ids in the order they were selected, and the changes a list needs.
export function useSelection() {
  const [ids, setIds] = useState([])

  const has = useCallback((id) => ids.includes(id), [ids])
  const toggle = useCallback((id) => setIds((old) => (old.includes(id) ? old.filter((x) => x !== id) : [...old, id])), [])
  // Selects (on) or unselects (off) all of these ids at once
  const setMany = useCallback((many, on) => setIds((old) => (on ? [...old, ...many.filter((id) => !old.includes(id))] : old.filter((id) => !many.includes(id)))), [])
  const clear = useCallback(() => setIds((old) => (old.length ? [] : old)), [])
  // Drops the ids that are no longer in the list (an entry was deleted, or a new search replaced the results)
  const keepOnly = useCallback((existing) => setIds((old) => {
    const kept = old.filter((id) => existing.includes(id))
    return kept.length === old.length ? old : kept
  }), [])

  return useMemo(() => ({ ids, count: ids.length, has, toggle, setMany, clear, keepOnly }), [ids, has, toggle, setMany, clear, keepOnly])
}
