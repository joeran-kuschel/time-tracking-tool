import { Trans, useLingui } from '@lingui/react/macro'
import { formatHours, hoursBetween } from '../format'

const dateTime = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }

function EntriesList({ entries }) {
  const { i18n } = useLingui()

  if (entries.length === 0) {
    return <p className="text-gray-500"><Trans>No entries yet</Trans></p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-100 border-b">
            <th className="px-4 py-2 text-left"><Trans>Start</Trans></th>
            <th className="px-4 py-2 text-left"><Trans>End</Trans></th>
            <th className="px-4 py-2 text-right"><Trans>Hours</Trans></th>
            <th className="px-4 py-2 text-left"><Trans>Description</Trans></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2">{i18n.date(entry.start_time, dateTime)}</td>
              <td className="px-4 py-2">
                {entry.end_time ? i18n.date(entry.end_time, dateTime) : <Trans>Active</Trans>}
              </td>
              <td className="px-4 py-2 text-right">
                {formatHours(i18n, hoursBetween(entry.start_time, entry.end_time))}
              </td>
              <td className="px-4 py-2 text-gray-600">{entry.description || '---'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default EntriesList
