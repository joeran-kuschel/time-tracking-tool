import { useId } from 'react'
import { ArrowDownTrayIcon, ArrowTopRightOnSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Trans, useLingui } from '@lingui/react/macro'
import { formatAmount } from '../../format'
import { formatInvoiceDay } from '../../invoices'
import { ui } from '../../ui'
import ConfirmDelete from '../ConfirmDelete'
import ErrorMessage from '../ErrorMessage'
import { api } from '../../api'
import { cell, headCell, link } from './table'

// The created invoices, newest first, each with its stored PDF (to open and to download) and a way to delete it.
// invoices: the list of the API, or null while it loads. deleting: the id of the invoice that is asked about.
function InvoiceList({ invoices, headingRef, error, onRetry, retrying, deletingId, deleteError, downloading, onDownload, onAskDelete, onCancelDelete, onDelete }) {
  const headingId = useId()

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="font-serif text-2xl font-semibold focus:outline-none"><Trans>Created invoices</Trans></h2>

      {!invoices && (error || retrying) && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-danger-line bg-danger-soft p-4">
          <ErrorMessage message={error} />
          <button type="button" onClick={onRetry} aria-disabled={retrying} className={`${ui.buttonPrimary} aria-disabled:opacity-70`}>
            <Trans>Try again</Trans>
          </button>
        </div>
      )}
      {!invoices && !error && !retrying && <p role="status" className="text-muted"><Trans>Loading...</Trans></p>}
      {invoices?.length === 0 && <p className="text-muted"><Trans>No invoices yet.</Trans></p>}

      {invoices?.length > 0 && (
        <div className={`${ui.card} overflow-x-auto !p-2 sm:!p-3`}>
          <table aria-labelledby={headingId} className="w-full border-collapse text-[0.9375rem]">
            <thead>
              <tr className="text-left">
                <th scope="col" className={headCell}><Trans>Number</Trans></th>
                <th scope="col" className={headCell}><Trans>Date</Trans></th>
                <th scope="col" className={headCell}><Trans>Customer</Trans></th>
                <th scope="col" className={headCell}><Trans>Period</Trans></th>
                <th scope="col" className={`${headCell} text-right`}><Trans>Total</Trans></th>
                <th scope="col" className={headCell}><span className="sr-only"><Trans>Actions</Trans></span></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <InvoiceRows key={invoice.id} invoice={invoice} deleting={deletingId === invoice.id} deleteError={deleteError}
                  downloading={downloading} onDownload={onDownload} onAskDelete={onAskDelete} onCancelDelete={onCancelDelete} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// One invoice: its row, and below it the question in place when it is the one to delete
function InvoiceRows({ invoice, deleting, deleteError, downloading, onDownload, onAskDelete, onCancelDelete, onDelete }) {
  const { t, i18n } = useLingui()
  const number = invoice.number
  const from = formatInvoiceDay(i18n, invoice.periodFrom)
  const to = formatInvoiceDay(i18n, invoice.periodTo)
  return (
    <>
      <tr>
        <td className={`${cell} whitespace-nowrap font-mono text-sm`}>{number}</td>
        <td className={`${cell} whitespace-nowrap`}>{formatInvoiceDay(i18n, invoice.invoiceDate)}</td>
        <td className={cell}>{invoice.customerName}{invoice.customerId === null && <span className="text-muted"> <Trans>(deleted)</Trans></span>}</td>
        <td className={`${cell} whitespace-nowrap`}>{from} – {to}</td>
        <td className={`${cell} whitespace-nowrap text-right font-mono text-sm`}>{formatAmount(i18n, invoice.gross)}</td>
        <td className={`${cell} whitespace-nowrap text-right`}>
          <div className="flex items-center justify-end gap-1">
            <a
              href={api.invoicePdfUrl(invoice.id)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t`Open PDF of invoice ${number} in a new tab`}
              className={link}
            >
              <ArrowTopRightOnSquareIcon aria-hidden="true" className="h-4 w-4" />
              <Trans>Open</Trans>
            </a>
            <button
              type="button"
              id={`invoice-download-${invoice.id}`}
              onClick={() => onDownload(invoice)}
              aria-disabled={downloading}
              aria-label={t`Download PDF of invoice ${number}`}
              className={`${link} aria-disabled:opacity-70`}
            >
              <ArrowDownTrayIcon aria-hidden="true" className="h-4 w-4" />
              <Trans>Download</Trans>
            </button>
            <button type="button" onClick={() => onAskDelete(invoice)} aria-label={t`Delete invoice ${number}`} title={t`Delete invoice ${number}`} className={`${ui.iconButton} h-11 w-11`}>
              <TrashIcon aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </td>
      </tr>
      {deleting && (
        <tr>
          <td colSpan={6} className="px-3 pb-3">
            <ConfirmDelete
              message={t`Delete invoice ${number}? Its number stays used and is never reused. An invoice you have sent should be kept.`}
              onConfirm={() => onDelete(invoice)}
              onCancel={onCancelDelete}
              error={deleteError}
            />
          </td>
        </tr>
      )}
    </>
  )
}

export default InvoiceList
