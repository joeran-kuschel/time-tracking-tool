function EntriesList({ entries }) {
  const calculateHours = (startTime, endTime) => {
    if (!endTime) return 0
    const diff = new Date(endTime) - new Date(startTime)
    return (diff / (1000 * 60 * 60)).toFixed(2)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (entries.length === 0) {
    return <p className="text-gray-500">Noch keine Einträge</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-100 border-b">
            <th className="px-4 py-2 text-left">Start</th>
            <th className="px-4 py-2 text-left">Ende</th>
            <th className="px-4 py-2 text-right">Stunden</th>
            <th className="px-4 py-2 text-left">Beschreibung</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2">{formatDate(entry.start_time)}</td>
              <td className="px-4 py-2">
                {entry.end_time ? formatDate(entry.end_time) : 'Aktiv'}
              </td>
              <td className="px-4 py-2 text-right">
                {calculateHours(entry.start_time, entry.end_time)}h
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
