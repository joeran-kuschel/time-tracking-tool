import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { ui } from '../ui'

// Icon buttons to edit and delete a record. The title names the record, e.g. "Edit Muster GmbH":
// it is the tooltip and, since the icons are hidden, the accessible name. An aria-label with the same
// text would turn the title into a description that screen readers announce a second time.
// Refs let focus return to the buttons.
function RecordActions({ editLabel, deleteLabel, onEdit, onDelete, editButton, deleteButton }) {
  return (
    <>
      <button type="button" ref={editButton} onClick={onEdit} title={editLabel} className={ui.iconButton}>
        <PencilSquareIcon aria-hidden="true" className="h-5 w-5" />
      </button>
      <button type="button" ref={deleteButton} onClick={onDelete} title={deleteLabel} className={ui.iconButton}>
        <TrashIcon aria-hidden="true" className="h-5 w-5" />
      </button>
    </>
  )
}

export default RecordActions
