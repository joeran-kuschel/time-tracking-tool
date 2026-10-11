import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '../support/render'
import userEvent from '@testing-library/user-event'
import { axe } from '../support/axe'
import EntryForm from '@/components/EntryForm'
import { fromInputs } from '@/entryTime'

const projects = [{ id: 7, name: 'Website' }, { id: 8, name: 'Shop' }]

function renderForm(props) {
  return render(<EntryForm projects={projects} projectId={7} legend="Zeit nachtragen" submitLabel="Speichern"
    onSubmit={vi.fn().mockResolvedValue({ id: 1 })} onCancel={vi.fn()} {...props} />)
}

async function fill(date, start, end) {
  const field = (label) => screen.getByLabelText(label)
  await userEvent.clear(field('Datum'))
  await userEvent.type(field('Datum'), date)
  await userEvent.type(field('Start'), start)
  await userEvent.type(field('Ende'), end)
}

describe('EntryForm', () => {
  test('adds an entry for the selected project with local times', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ id: 1 })
    renderForm({ onSubmit })

    expect(screen.getByLabelText('Projekt')).toHaveValue('7')
    await fill('2026-09-21', '08:00', '09:30')
    await userEvent.type(screen.getByLabelText('Beschreibung (optional)'), 'Konzept')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(onSubmit).toHaveBeenCalledWith({
      projectId: 7,
      startTime: fromInputs('2026-09-21', '08:00'),
      endTime: fromInputs('2026-09-21', '09:30'),
      description: 'Konzept',
    })
  })

  test('refuses an end that is not after the start and points to the end field', async () => {
    const onSubmit = vi.fn()
    renderForm({ onSubmit })

    await fill('2026-09-21', '10:00', '09:00')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Ende')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Ende')).toHaveAccessibleDescription('Das Ende muss nach dem Start liegen.')
  })

  test('edits an entry, including moving it to another project', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ id: 1 })
    const entry = { id: 1, project_id: 7, start_time: fromInputs('2026-09-21', '08:00'), end_time: fromInputs('2026-09-21', '09:00'), description: 'Alt' }
    renderForm({ entry, onSubmit })

    expect(screen.getByLabelText('Start')).toHaveValue('08:00')
    expect(screen.getByLabelText('Beschreibung (optional)')).toHaveValue('Alt')
    await userEvent.selectOptions(screen.getByLabelText('Projekt'), '8')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ projectId: 8, endTime: fromInputs('2026-09-21', '09:00') }))
  })

  test('keeps the day offset of an entry that ran past midnight', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ id: 1 })
    const entry = { id: 1, project_id: 7, start_time: fromInputs('2026-09-21', '22:00'), end_time: fromInputs('2026-09-22', '01:00'), description: null }
    renderForm({ entry, onSubmit })

    expect(screen.getByLabelText('Ende (nächster Tag)')).toHaveValue('01:00')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      startTime: fromInputs('2026-09-21', '22:00'),
      endTime: fromInputs('2026-09-22', '01:00'),
    }))
  })

  test('has no detectable accessibility violations', async () => {
    const { container } = renderForm()
    expect(await axe(container)).toHaveNoViolations()
  })
})
