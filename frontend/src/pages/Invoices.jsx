import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'
import { api } from '../api'
import { formatAmount } from '../format'
import { useAction } from '../hooks/useAction'
import { useRetry } from '../hooks/useRetry'
import ErrorMessage from '../components/ErrorMessage'
import InvoiceList from '../components/invoices/InvoiceList'
import InvoicePreview from '../components/invoices/InvoicePreview'
import { link } from '../components/invoices/table'
import { dayOf, isDay, MAX_DAYS, overlappingInvoices, periodProblem, previousMonth } from '../invoices'
import { ui } from '../ui'

// What the answer of a failed creation adds to the message
const createHints = {
  404: msg`The customer does not exist any more.`,
  409: msg`The invoice number is already used. Raise the next invoice number in the settings.`,
  422: msg`Something the invoice needs is missing. The list above shows what.`,
}

// Invoices: make one for a customer and a period, and the ones that are made. Choosing a customer and a period loads the
// preview (the lines, the totals and what is missing) by itself, like the report loads; creating asks in place first, because
// the invoice cannot be changed and its number is used up. customers: the list of App.
function Invoices({ customers }) {
  const { t, i18n } = useLingui()
  const [customerId, setCustomerId] = useState(null)
  // Starts with the whole previous month and today, as invoices are usually made after a month
  const [{ from: initialFrom, to: initialTo }] = useState(() => previousMonth())
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [invoiceDate, setInvoiceDate] = useState(() => dayOf(new Date()))
  // Round the hours once per day and task instead of once per entry (only matters with a rounding rule)
  const [groupByTask, setGroupByTask] = useState(false)
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  // Raised to load the preview again for the same choice (after creating, or when creating found something changed)
  const [reload, setReload] = useState(0)
  const [invoices, setInvoices] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [downloading, setDownloading] = useState(false)
  // What the polite status line says: { kind: 'created' | 'deleted', number }
  const [notice, setNotice] = useState(null)
  // The id of the invoice that was just created: its download button gets the focus once the list shows it
  const [focusId, setFocusId] = useState(null)
  const [createStatus, setCreateStatus] = useState(null)
  const [runPreview, previewError, clearPreview] = useAction()
  const [runList, listError] = useAction()
  const [runCreate, createError, clearCreate] = useAction()
  const [runDelete, deleteError, clearDelete] = useAction()
  const [runDownload, downloadError] = useAction()
  const busy = useRef({ create: false, download: false })
  const listHeading = useRef(null)
  const createErrorBox = useRef(null)
  const customerFieldId = useId()
  const fromFieldId = useId()
  const toFieldId = useId()
  const dateFieldId = useId()
  const periodErrorId = useId()

  // Only the newest load counts, so a slow answer never brings back what a later load no longer has
  const listLoads = useRef(0)
  const loadInvoices = useCallback(async () => {
    const load = ++listLoads.current
    const data = await runList(api.getInvoices, msg`Invoices could not be loaded.`)
    if (data && load === listLoads.current) setInvoices(data)
    // The row that was to get the focus is not coming
    if (!data) setFocusId(null)
  }, [runList])
  const [retryList, retryingList] = useRetry(loadInvoices)
  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  // A customer that is gone from the list (deleted elsewhere) is no choice any more
  const chosenId = customers.some((c) => c.id === customerId) ? customerId : null
  const problem = periodProblem(from, to)
  const request = { customerId: chosenId, from, to, invoiceDate, lang: i18n.locale, groupByTask }
  const ready = chosenId !== null && !problem && isDay(invoiceDate)
  useEffect(() => {
    setPreview(null)
    setConfirming(false)
    setPreviewing(false)
    if (!ready) {
      clearPreview()
      return
    }
    // Only the answer for the current choice is shown, and only its failure: an older request that fails late is ignored
    let current = true
    setPreviewing(true)
    const ask = async () => {
      try {
        return await api.previewInvoice(request)
      } catch (err) {
        if (current) throw err
        return undefined
      }
    }
    runPreview(ask, msg`The invoice could not be prepared.`).then((data) => {
      if (!current) return
      if (data) setPreview(data)
      setPreviewing(false)
    })
    return () => { current = false }
  }, [ready, chosenId, from, to, invoiceDate, groupByTask, i18n.locale, reload])

  // A message about the last invoice that was made or deleted does not stay when the choice for the next one changes
  // (and the error of the last creation does not stay either)
  useEffect(() => {
    setNotice(null)
    clearCreate()
    setCreateStatus(null)
  }, [chosenId, from, to, invoiceDate, groupByTask])

  // After a failed creation the question is gone, so the focus goes to the error, where the keyboard and the screen reader are
  useEffect(() => {
    if (createError && !confirming) createErrorBox.current?.focus()
  }, [createError, confirming])

  // After creating, the focus goes to the download button of the new invoice, as soon as the list has its row
  useEffect(() => {
    if (focusId === null) return
    const button = document.getElementById(`invoice-download-${focusId}`)
    if (button) {
      button.focus()
      setFocusId(null)
    }
  }, [invoices, focusId])

  const create = async () => {
    if (busy.current.create) return
    busy.current.create = true
    setCreating(true)
    setCreateStatus(null)
    setNotice(null)
    const created = await runCreate(async () => {
      try {
        return await api.createInvoice(request)
      } catch (err) {
        setCreateStatus(err.status)
        throw err
      }
    }, msg`The invoice could not be created.`, createHints)
    busy.current.create = false
    setCreating(false)
    if (!created) {
      // The preview was out of date (details changed, customer gone): show what is true now
      setConfirming(false)
      setReload((n) => n + 1)
      return
    }
    setConfirming(false)
    setNotice({ kind: 'created', number: created.number })
    setFocusId(created.id)
    await loadInvoices()
    setReload((n) => n + 1)
  }

  const removeInvoice = async (invoice) => {
    setNotice(null)
    setFocusId(null)
    const deleted = await runDelete(() => api.deleteInvoice(invoice.id), msg`The invoice could not be deleted.`)
    if (deleted === undefined) return
    setDeletingId(null)
    setNotice({ kind: 'deleted', number: invoice.number })
    await loadInvoices()
    setReload((n) => n + 1)
    listHeading.current?.focus()
  }

  // One download at a time; the ref also stops a second click that comes before the next render
  const download = async (invoice) => {
    if (busy.current.download) return
    busy.current.download = true
    setDownloading(true)
    await runDownload(() => api.downloadInvoicePdf(invoice.id), msg`The PDF could not be downloaded.`)
    busy.current.download = false
    setDownloading(false)
  }

  const customer = customers.find((c) => c.id === chosenId)
  // Right after creating, the invoice that was just made is not one to warn about; the notice is gone when the choice changes
  const overlapping = preview && notice?.kind !== 'created' ? overlappingInvoices(invoices ?? [], chosenId, from, to) : []
  const maxDays = MAX_DAYS
  const periodMessage = {
    days: t`Enter the first and the last day of the period.`,
    order: t`The first day must not be after the last day.`,
    long: t`The period can be at most ${maxDays} days.`,
  }[problem]
  const number = notice?.number
  const previewTotal = preview ? formatAmount(i18n, preview.gross) : null

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 sm:px-8 sm:py-9">
      <h1 className="font-serif text-4xl font-semibold leading-tight"><Trans>Invoices</Trans></h1>

      <section aria-labelledby={`${customerFieldId}-heading`} className="flex flex-col gap-5">
        <h2 id={`${customerFieldId}-heading`} className="font-serif text-2xl font-semibold"><Trans>New invoice</Trans></h2>

        <div className="flex flex-wrap items-start gap-4">
          <div>
            <label htmlFor={customerFieldId} className={ui.label}><Trans>Customer</Trans></label>
            <select id={customerFieldId} value={chosenId ?? ''} onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : null)} className={`${ui.select} w-72 max-w-full`}>
              <option value="">{t`Select a customer`}</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={fromFieldId} className={ui.label}><Trans>From</Trans></label>
            <input id={fromFieldId} type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={problem ? true : undefined} aria-describedby={problem ? periodErrorId : undefined} className={`${ui.input} w-44`} />
          </div>
          <div>
            <label htmlFor={toFieldId} className={ui.label}><Trans>To</Trans></label>
            <input id={toFieldId} type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-invalid={problem ? true : undefined} aria-describedby={problem ? periodErrorId : undefined} className={`${ui.input} w-44`} />
          </div>
          <div>
            <label htmlFor={dateFieldId} className={ui.label}><Trans>Invoice date</Trans></label>
            <input id={dateFieldId} type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} aria-invalid={isDay(invoiceDate) ? undefined : true} className={`${ui.input} w-44`} />
          </div>
        </div>
        <label className="flex min-h-[2.75rem] items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={groupByTask} onChange={(e) => setGroupByTask(e.target.checked)} className="h-5 w-5 accent-accent" />
          <Trans>Round the hours per day and task</Trans>
        </label>
        <ErrorMessage id={periodErrorId} message={periodMessage} />
        {!isDay(invoiceDate) && <ErrorMessage message={t`Enter the invoice date.`} />}

        <ErrorMessage message={previewError} />
        {chosenId === null && <p className="text-muted"><Trans>Select a customer to prepare an invoice.</Trans></p>}
        {previewing && <p role="status" className="text-muted"><Trans>Loading...</Trans></p>}
        {preview && (
          <InvoicePreview
            preview={preview}
            customer={customer}
            overlapping={overlapping}
            confirming={confirming}
            creating={creating}
            createError={createError}
            onAskCreate={() => { clearCreate(); setConfirming(true) }}
            onCancel={() => { if (!creating) setConfirming(false) }}
            onCreate={create}
          />
        )}
        {!confirming && createError && (
          <div ref={createErrorBox} tabIndex={-1} className="flex flex-wrap items-center gap-3 focus:outline-none">
            <ErrorMessage message={createError} />
            {createStatus === 409 && <Link to="/settings" className={link}><Trans>Open Settings</Trans></Link>}
          </div>
        )}
        <p role="status" className="sr-only">{previewTotal && t`The invoice would be ${previewTotal} in total.`}</p>
        <p role="status" className="text-sm">
          {notice?.kind === 'created' && <Trans>Invoice {number} created.</Trans>}
          {notice?.kind === 'deleted' && <Trans>Invoice {number} deleted.</Trans>}
        </p>
        <ErrorMessage message={downloadError} />
      </section>

      <InvoiceList
        invoices={invoices}
        headingRef={listHeading}
        error={listError}
        onRetry={retryList}
        retrying={retryingList}
        deletingId={deletingId}
        deleteError={deleteError}
        downloading={downloading}
        onDownload={download}
        onAskDelete={(invoice) => { clearDelete(); setDeletingId(invoice.id) }}
        onCancelDelete={() => setDeletingId(null)}
        onDelete={removeInvoice}
      />
    </div>
  )
}

export default Invoices
