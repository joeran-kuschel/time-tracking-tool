import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import RecordForm from '@/components/RecordForm'

const fields = [
  { name: 'name', label: 'Name', required: true },
  { name: 'email', label: 'E-Mail (optional)', type: 'email' },
]

function renderForm(props) {
  return render(<RecordForm legend="Neuer Kunde" fields={fields} initialValues={{ name: '', email: '' }}
    submitLabel="Speichern" onSubmit={vi.fn().mockResolvedValue({ id: 1 })} {...props} />)
}

describe('RecordForm', () => {
  test('a field can limit its length, and a textarea can set its rows', () => {
    render(<RecordForm fields={[
      { name: 'taxId', label: 'Steuernummer', maxLength: 30 },
      { name: 'address', label: 'Adresse', type: 'textarea', rows: 4, maxLength: 300 },
      { name: 'note', label: 'Notiz', type: 'textarea' },
    ]} initialValues={{ taxId: '', address: '', note: '' }} submitLabel="Speichern" onSubmit={vi.fn()} />)

    expect(screen.getByLabelText('Steuernummer')).toHaveAttribute('maxlength', '30')
    expect(screen.getByLabelText('Adresse')).toHaveAttribute('maxlength', '300')
    expect(screen.getByLabelText('Adresse')).toHaveAttribute('rows', '4')
    expect(screen.getByLabelText('Adresse')).not.toHaveClass('h-20')
    // Without rows a textarea keeps its fixed height, and without maxLength it has no limit
    expect(screen.getByLabelText('Notiz')).toHaveClass('h-20')
    expect(screen.getByLabelText('Notiz')).not.toHaveAttribute('maxlength')
  })

  test('has visible labels in a named group and submits the values', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ id: 1 })
    renderForm({ onSubmit })

    expect(screen.getByRole('group', { name: 'Neuer Kunde' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Name'), 'Muster GmbH')
    await userEvent.type(screen.getByLabelText('E-Mail (optional)'), 'info@muster.de')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Muster GmbH', email: 'info@muster.de' })
  })

  test('a create form resets after saving, and keeps the values when saving fails', async () => {
    const onSubmit = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: 1 })
    renderForm({ onSubmit })

    await userEvent.type(screen.getByLabelText('Name'), 'Muster GmbH')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Muster GmbH')

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(screen.getByLabelText('Name')).toHaveValue('')
  })

  test('an edit form starts with the values, focuses the first field and cancels with Escape', async () => {
    const onCancel = vi.fn()
    renderForm({ initialValues: { name: 'Muster GmbH', email: '' }, onCancel, autoFocus: true })

    expect(screen.getByLabelText('Name')).toHaveValue('Muster GmbH')
    expect(screen.getByLabelText('Name')).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  test('a validation error blocks saving and is linked to its field', async () => {
    const onSubmit = vi.fn()
    renderForm({ onSubmit, validate: (values) => (values.email.includes('@') ? null : { field: 'email', message: 'Ungültige E-Mail.' }) })

    await userEvent.type(screen.getByLabelText('Name'), 'Muster')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Ungültige E-Mail.')
    expect(screen.getByLabelText('E-Mail (optional)')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('E-Mail (optional)')).toHaveAccessibleDescription('Ungültige E-Mail.')
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid')
  })

  test('shows the error it is given', () => {
    renderForm({ error: 'Kunde konnte nicht gespeichert werden.' })
    expect(screen.getByRole('alert')).toHaveTextContent('Kunde konnte nicht gespeichert werden.')
  })

  test('renders a select field as a native select with the shared select style', async () => {
    const options = [{ value: 'a', label: 'Option A' }, { value: 'b', label: 'Option B' }]
    const { container } = renderForm({
      fields: [{ name: 'kind', label: 'Art', type: 'select', options }],
      initialValues: { kind: 'a' },
    })

    const select = screen.getByLabelText('Art')
    expect(select.tagName).toBe('SELECT')
    expect(select).toHaveClass('appearance-none', 'pr-11')
    expect(select).not.toHaveClass('px-3')
    expect(await axe(container)).toHaveNoViolations()
  })

  describe('suggestions', () => {
    const suggestionFields = (suggestions) => [{ name: 'task', label: 'Aufgabe', suggestions }]
    const renderSuggestions = (suggestions) => render(
      <RecordForm fields={suggestionFields(suggestions)} initialValues={{ task: '' }} submitLabel="Speichern" onSubmit={vi.fn()} />
    )

    test('a text field offers its suggestions as a list that the field points to', () => {
      const { container } = renderSuggestions(['Fix login', 'Review'])

      const list = container.querySelector('datalist')
      expect(screen.getByLabelText('Aufgabe')).toHaveAttribute('list', list.id)
      expect([...list.options].map((option) => option.value)).toEqual(['Fix login', 'Review'])
    })

    test('without suggestions, or with an empty list, the field has no list', () => {
      for (const suggestions of [undefined, []]) {
        const { container, unmount } = renderSuggestions(suggestions)

        expect(screen.getByLabelText('Aufgabe')).not.toHaveAttribute('list')
        expect(container.querySelector('datalist')).toBeNull()
        unmount()
      }
    })

    test('the suggestions do not stop the user from typing something else, and it is submitted', async () => {
      const onSubmit = vi.fn().mockResolvedValue(true)
      render(<RecordForm fields={suggestionFields(['Fix login'])} initialValues={{ task: '' }} submitLabel="Speichern" onSubmit={onSubmit} />)

      await userEvent.type(screen.getByLabelText('Aufgabe'), 'Etwas Neues')
      await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

      expect(onSubmit).toHaveBeenCalledWith({ task: 'Etwas Neues' })
    })

    test('two forms on one page do not share a list id', () => {
      const { container } = render(<>
        <RecordForm fields={suggestionFields(['A'])} initialValues={{ task: '' }} submitLabel="Eins" onSubmit={vi.fn()} />
        <RecordForm fields={suggestionFields(['B'])} initialValues={{ task: '' }} submitLabel="Zwei" onSubmit={vi.fn()} />
      </>)

      const ids = [...container.querySelectorAll('datalist')].map((list) => list.id)
      expect(new Set(ids).size).toBe(2)
    })

    test('has no accessibility violations', async () => {
      const { container } = renderSuggestions(['Fix login'])

      expect(await axe(container)).toHaveNoViolations()
    })
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = renderForm({ onCancel: vi.fn(), error: 'Fehler.' })
    expect(await axe(container)).toHaveNoViolations()
  })
})
