import { useId } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { formatAmount, formatDuration, formatRate } from '../../format'
import { formatInvoiceDay } from '../../invoices'
import { languageName } from '../../reportLanguage'
import { ui } from '../../ui'
import ConfirmAction from '../ConfirmAction'
import MissingDetails from './MissingDetails'
import { cell, footCell, headCell, totalCell } from './table'

// The invoice as the backend's preview describes it: the lines, the totals and what is missing, with the button that
// creates it (after a question in place, because the number is used up). customer: the record of the customer (for its
// report language); overlapping: the invoices that already cover part of this period.
function InvoicePreview({ preview, customer, overlapping, confirming, creating, createError, onAskCreate, onCancel, onCreate }) {
  const { t, i18n } = useLingui()
  const headingId = useId()
  const reasonId = useId()
  const smallBusiness = preview.vatMode === 'small_business'
  const canCreate = preview.missing.length === 0
  const number = preview.number
  const customerName = preview.customer.name
  const total = formatAmount(i18n, preview.gross)
  const language = languageName(i18n, preview.language)
  const languageNote = customer?.report_language
    ? t`The invoice is in ${language} (the report language of this customer).`
    : t`The invoice is in ${language} (the language of the app).`
  const vatRate = preview.vatRate
  const from = formatInvoiceDay(i18n, preview.from)
  const to = formatInvoiceDay(i18n, preview.to)
  const date = formatInvoiceDay(i18n, preview.invoiceDate)

  return (
    <section aria-labelledby={headingId} className={`${ui.card} flex flex-col gap-5`}>
      <div>
        <p className={ui.eyebrow}><Trans>Preview</Trans></p>
        <h3 id={headingId} className="font-serif text-2xl font-semibold leading-tight"><Trans>Invoice for {customerName}</Trans></h3>
        <p className="mt-1 text-sm text-muted"><Trans>{from} to {to}, dated {date}</Trans></p>
        <p className="text-sm text-muted"><Trans>Invoice number {number}. It is given when you create the invoice.</Trans></p>
        <p className="text-sm text-muted">{languageNote}</p>
      </div>

      {!canCreate && <MissingDetails missing={preview.missing} customerId={preview.customer.id} />}

      {overlapping.length > 0 && (
        <div role="status" className="rounded-lg border border-line-strong bg-paper p-4 text-sm">
          <p className="font-medium"><Trans>Check before you create it: this customer already has an invoice for this period.</Trans></p>
          <ul className="mt-1 list-disc pl-5">
            {overlapping.map((invoice) => {
              const existing = invoice.number
              const existingFrom = formatInvoiceDay(i18n, invoice.periodFrom)
              const existingTo = formatInvoiceDay(i18n, invoice.periodTo)
              return <li key={invoice.id}><Trans>Invoice {existing} covers {existingFrom} to {existingTo}.</Trans></li>
            })}
          </ul>
        </div>
      )}

      {preview.lines.length > 0 && (
        <div className="overflow-x-auto">
          <table aria-labelledby={headingId} className="w-full border-collapse text-[0.9375rem]">
            <thead>
              <tr className="text-left">
                <th scope="col" className={headCell}><Trans>Project</Trans></th>
                <th scope="col" className={`${headCell} text-right`}><Trans>Hours</Trans></th>
                <th scope="col" className={`${headCell} text-right`}><Trans>Rate</Trans></th>
                <th scope="col" className={`${headCell} text-right`}><Trans>Amount</Trans></th>
              </tr>
            </thead>
            <tbody>
              {preview.lines.map((line) => (
                <tr key={`${line.projectId}-${line.name}`}>
                  <td className={cell}>{line.name}</td>
                  <td className={`${cell} whitespace-nowrap text-right font-mono text-sm`}>{formatDuration(i18n, line.minutes)}</td>
                  <td className={`${cell} whitespace-nowrap text-right font-mono text-sm`}>{formatRate(i18n, line.hourlyRate)}</td>
                  <td className={`${cell} whitespace-nowrap text-right font-mono text-sm`}>{formatAmount(i18n, line.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {!smallBusiness && (
                <>
                  <tr>
                    <th scope="row" colSpan={3} className={`${footCell} text-right`}><Trans>Net amount</Trans></th>
                    <td className={`${footCell} whitespace-nowrap text-right font-mono text-sm`}>{formatAmount(i18n, preview.net)}</td>
                  </tr>
                  <tr>
                    <th scope="row" colSpan={3} className={`${footCell} text-right`}><Trans>VAT {vatRate} %</Trans></th>
                    <td className={`${footCell} whitespace-nowrap text-right font-mono text-sm`}>{formatAmount(i18n, preview.vat)}</td>
                  </tr>
                </>
              )}
              <tr>
                <th scope="row" colSpan={3} className={`${totalCell} text-right`}><Trans>Total amount</Trans></th>
                <td className={`${totalCell} whitespace-nowrap text-right font-mono text-sm`}>{total}</td>
              </tr>
            </tfoot>
          </table>
          {smallBusiness && <p className="mt-2 text-sm text-muted"><Trans>No VAT is charged under section 19 of the German VAT Act (UStG).</Trans></p>}
        </div>
      )}

      {confirming ? (
        <ConfirmAction
          message={t`Create invoice ${number} for ${customerName} over ${total}? The number is used up and the invoice cannot be changed.`}
          confirmLabel={t`Create invoice`}
          onConfirm={onCreate}
          onCancel={onCancel}
          busy={creating}
          error={createError}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={canCreate ? onAskCreate : undefined}
            aria-disabled={!canCreate}
            aria-describedby={canCreate ? undefined : reasonId}
            className={`${ui.buttonPrimary} aria-disabled:opacity-60`}
          >
            <Trans>Create invoice</Trans>
          </button>
          {!canCreate && <p id={reasonId} className="text-sm text-muted"><Trans>Put right what is missing first.</Trans></p>}
        </div>
      )}
    </section>
  )
}

export default InvoicePreview
