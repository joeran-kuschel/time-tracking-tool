import { useEffect, useRef, useState } from 'react'
import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { api } from '../api'
import { useAction } from '../hooks/useAction'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import EntryFilters from '../components/EntryFilters'
import SetTaskBar from '../components/SetTaskBar'
import { useBulkTask } from '../hooks/useBulkTask'
import { tasksOfAll } from '../tasks'
import EntryResults from '../components/EntryResults'
import ErrorMessage from '../components/ErrorMessage'
import { emptyFilters, isReversed, openingFilters, toQuery } from '../filters'

const PAGE_SIZE = 50

const appendNew = (shown, page) => [...shown, ...page.filter((entry) => !shown.some((e) => e.id === entry.id))]

// Search and filter the entries of all customers. Opens with the current month; the filters live in this page's
// state, so they are gone when another page opens. The search text applies after a short pause or on Enter,
// everything else at once. Results come from the backend, PAGE_SIZE at a time.
// firstDay: the first day of the week (1 Monday, 0 Sunday) for the period choices This week and Last week.
// timer and onResume(entry) (App): the Resume buttons of the results; the results reload when the running timer changes.
function Entries({ customers, timer, onResume, firstDay }) {
  const [filters, setFilters] = useState(() => openingFilters(new Date()))
  const [searchText, applySearchText] = useDebouncedValue(filters.q)
  const [projects, setProjects] = useState([])
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [run, error] = useAction()
  const [runProjects, projectsError] = useAction()
  // Counts the requests, so only the answer to the latest one is used
  const latest = useRef(0)

  // Setting the task of several results; the first page is loaded again afterwards, and what is selected is gone with a new search
  // The reload after a success uses the query of the latest render, not the one of the render that sent the request
  const reload = useRef(null)
  const bulk = useBulkTask(() => reload.current(0))

  const applied = { ...filters, q: searchText }
  const reversed = isReversed(filters)
  const query = toQuery(applied)
  const queryKey = JSON.stringify(query)

  const load = async (offset) => {
    const request = ++latest.current
    setLoading(offset === 0)
    setLoadingMore(offset > 0)
    const data = await run(() => api.searchTimeEntries(query, { limit: PAGE_SIZE, offset }), msg`Entries could not be loaded.`)
    if (request !== latest.current) return
    // After an error the old results stay
    // An entry can move to the previous page between two requests, so a page only adds entries not shown yet
    if (data) setResults((old) => (offset > 0 ? { ...data, entries: appendNew(old.entries, data.entries) } : data))
    setLoading(false)
    setLoadingMore(false)
  }

  reload.current = load

  useEffect(() => {
    if (reversed) {
      // A request for the last valid filters is dropped, its busy state with it
      setLoading(false)
      setLoadingMore(false)
    } else {
      load(0)
    }
    return () => { latest.current++ }
  }, [queryKey, reversed])

  useEffect(() => {
    bulk.selection.keepOnly((results?.entries ?? []).map((entry) => entry.id))
  }, [results])

  // A timer started or stopped (Resume, the header) changes the entries shown, so the first page is loaded again
  const activeId = timer.activeEntry?.id
  const previousActiveId = useRef(activeId)
  useEffect(() => {
    if (previousActiveId.current === activeId) return
    previousActiveId.current = activeId
    if (!reversed) load(0)
  }, [activeId])

  useEffect(() => {
    setProjects([])
    if (!filters.customerId) return
    let current = true
    runProjects(() => api.getProjects(filters.customerId), msg`Projects could not be loaded.`).then((data) => {
      if (current && data) setProjects(data)
    })
    return () => { current = false }
  }, [filters.customerId])

  const change = (changes) => {
    setFilters((old) => ({ ...old, ...changes }))
    // Emptying the search field applies at once
    if (changes.q === '') applySearchText('')
  }

  const reset = () => {
    setFilters(emptyFilters)
    applySearchText('')
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:px-8 sm:py-9">
      <h1 className="font-serif text-4xl font-semibold leading-tight"><Trans>Entries</Trans></h1>

      <EntryFilters
        filters={filters}
        customers={customers}
        projects={projects}
        firstDay={firstDay}
        onChange={change}
        onSearch={() => applySearchText(filters.q)}
        onReset={reset}
      />
      <ErrorMessage message={projectsError} />
      <ErrorMessage message={error} />

      <SetTaskBar count={bulk.selection.count} done={bulk.done} suggestions={tasksOfAll(results?.entries ?? [])} onApply={bulk.apply}
        onClear={bulk.selection.clear} busy={bulk.busy} error={bulk.error} />

      <EntryResults
        results={results}
        selection={bulk.selection}
        busy={loading || loadingMore}
        loadingMore={loadingMore}
        onShowMore={() => load(results.entries.length)}
        resume={{ onResume, timerRunning: Boolean(timer.activeEntry), busy: timer.busy }}
      />
    </div>
  )
}

export default Entries
