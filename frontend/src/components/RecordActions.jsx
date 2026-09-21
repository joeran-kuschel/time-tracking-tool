import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'

const buttonClass = 'p-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-100'

// Icon buttons to edit and delete a record. The title names the record, e.g. "Edit Muster GmbH":
// it is the tooltip and, since the icons are hidden, the accessible name. An aria-label with the same
// text would turn the title into a description that screen readers announce a second time.
// Refs let focus return to the buttons.
function RecordActions({ editLabel, deleteLabel, onEdit, onDelete, editButton, deleteButton }) {
  return (
    <>
      <button type="button" ref={editButton} onClick={onEdit} title={editLabel} className={buttonClass}>
        <PencilSquareIcon aria-hidden="true" className="h-5 w-5" />
      </button>
      <button type="button" ref={deleteButton} onClick={onDelete} title={deleteLabel} className={buttonClass}>
        <TrashIcon aria-hidden="true" className="h-5 w-5" />
      </button>
    </>
  )
}

export default RecordActions
