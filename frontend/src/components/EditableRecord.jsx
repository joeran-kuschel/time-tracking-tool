import { useLingui } from '@lingui/react/macro'
import { useEditable } from '../hooks/useEditable'
import RecordForm from './RecordForm'
import ConfirmDelete from './ConfirmDelete'
import RecordActions from './RecordActions'

// One record, edited in place or deleted after a confirmation.
// children(actions) renders the record in view mode; actions are its edit and delete buttons.
// form: { legend, fields, toValues(item) } for the edit form. onDeleted() should move focus somewhere that stays.
function EditableRecord({ item, form, onUpdate, onDelete, deleteMessage, messages, onDeleted, children }) {
  const { t } = useLingui()
  const editable = useEditable({ onUpdate: (values) => onUpdate(item, values), onDelete: () => onDelete(item), onDeleted, messages })
  const name = item.name

  if (editable.mode === 'edit') {
    return (
      <RecordForm
        legend={form.legend}
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

  return children(
    <RecordActions
      editLabel={t`Edit ${name}`}
      deleteLabel={t`Delete ${name}`}
      onEdit={editable.startEdit}
      onDelete={editable.startDelete}
      editButton={editable.editButton}
      deleteButton={editable.deleteButton}
    />
  )
}

export default EditableRecord
