import { useRef } from 'react'
import { useLingui } from '@lingui/react/macro'
import { useEditable } from '../hooks/useEditable'
import RecordForm from './RecordForm'
import ConfirmDelete from './ConfirmDelete'
import RecordActions from './RecordActions'

// One list item: select it, or edit or delete it in place.
function EditableItem({ item, selected, onSelect, renderItem, name, form, onUpdate, onDelete, deleteMessage, messages, onDeleted }) {
  const { t } = useLingui()
  const editable = useEditable({ onUpdate: (values) => onUpdate(item, values), onDelete: () => onDelete(item), onDeleted, messages })

  if (editable.mode === 'edit') {
    return (
      <RecordForm
        fields={form.fields}
        initialValues={form.toValues(item)}
        submitLabel={t`Save`}
        onSubmit={editable.save}
        onCancel={editable.cancel}
        error={editable.error}
        autoFocus
      />
    )
  }
  if (editable.mode === 'delete') {
    return <ConfirmDelete message={deleteMessage(item)} onConfirm={editable.remove} onCancel={editable.cancel} error={editable.error} />
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onSelect(item)}
        aria-pressed={selected}
        className={`flex-1 text-left px-3 py-2 rounded text-sm ${selected ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
      >
        {renderItem(item, selected)}
      </button>
      <RecordActions
        editLabel={t`Edit ${name}`}
        deleteLabel={t`Delete ${name}`}
        onEdit={editable.startEdit}
        onDelete={editable.startDelete}
        editButton={editable.editButton}
        deleteButton={editable.deleteButton}
      />
    </div>
  )
}

// A selectable list of customers or projects, each editable in place and deletable after a confirmation.
// form: { fields, toValues(item) } for the edit form. After deleting, focus moves to the list.
function EditableList({ label, items, selectedId, onSelect, renderItem, form, onUpdate, onDelete, deleteMessage, messages }) {
  const list = useRef(null)

  return (
    <ul ref={list} tabIndex={-1} aria-label={label} className="space-y-2 mb-4 max-h-80 overflow-y-auto">
      {items.map((item) => (
        <li key={item.id}>
          <EditableItem
            item={item}
            name={item.name}
            selected={item.id === selectedId}
            onSelect={onSelect}
            renderItem={renderItem}
            form={form}
            onUpdate={onUpdate}
            onDelete={onDelete}
            deleteMessage={deleteMessage}
            messages={messages}
            onDeleted={() => list.current?.focus()}
          />
        </li>
      ))}
    </ul>
  )
}

export default EditableList
