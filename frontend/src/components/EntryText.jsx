// The text of an entry in a list: its task in bold, then its description. empty: what shows when it has neither.
function EntryText({ entry, empty }) {
  if (!entry.task && !entry.description) return empty
  return (
    <>
      {entry.task && <span className="font-semibold">{entry.task}</span>}
      {entry.task && entry.description && <span className="text-muted"> · </span>}
      {entry.description}
    </>
  )
}

export default EntryText
