import { describe, expect, test, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { msg } from '@lingui/core/macro'
import { render, screen } from '../support/render'
import { axe } from '../support/axe'
import SettingField from '@/components/SettingField'

const numberSelect = {
  name: 'step',
  type: 'select',
  label: msg`Step`,
  hint: msg`Applies to every entry.`,
  disabledHint: msg`Choose a step first.`,
  choices: [{ value: 0, label: msg`Off` }, { value: 15, label: msg`Quarter` }, { value: 30, label: msg`Half` }],
}
const checkbox = { name: 'tidy', type: 'checkbox', label: msg`Tidy`, hint: msg`Keeps things tidy.`, disabledHint: msg`Not now.` }

describe('SettingField', () => {
  test('a select with number values shows the current number and gives numbers back', async () => {
    const onChange = vi.fn()
    render(<SettingField option={numberSelect} value={15} onChange={onChange} />)

    expect(screen.getByRole('combobox', { name: 'Step' })).toHaveValue('15')

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Step' }), 'Half')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Step' }), 'Off')

    expect(onChange).toHaveBeenNthCalledWith(1, 30)
    expect(onChange).toHaveBeenNthCalledWith(2, 0)
  })

  test('shows the number 0 as a chosen value, not as empty', () => {
    render(<SettingField option={numberSelect} value={0} onChange={() => {}} />)

    expect(screen.getByRole('combobox', { name: 'Step' })).toHaveValue('0')
    expect(screen.getByRole('option', { name: 'Off' }).selected).toBe(true)
  })

  test('a select with string values gives strings back', async () => {
    const onChange = vi.fn()
    const option = { name: 'd', type: 'select', label: msg`Dir`, choices: [{ value: 'up', label: msg`Up it` }, { value: 'nearest', label: msg`Near` }] }
    render(<SettingField option={option} value="up" onChange={onChange} />)

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Dir' }), 'Near')

    expect(onChange).toHaveBeenCalledWith('nearest')
  })

  test('is enabled and described by its hint by default', () => {
    render(<SettingField option={numberSelect} value={0} onChange={() => {}} />)

    const select = screen.getByRole('combobox', { name: 'Step' })
    expect(select).toBeEnabled()
    expect(select).toHaveAccessibleDescription('Applies to every entry.')
  })

  test('a disabled select is described by the reason instead of the hint', () => {
    render(<SettingField option={numberSelect} value={0} onChange={() => {}} disabled />)

    const select = screen.getByRole('combobox', { name: 'Step' })
    expect(select).toBeDisabled()
    expect(select).toHaveAccessibleDescription('Choose a step first.')
    expect(screen.queryByText('Applies to every entry.')).not.toBeInTheDocument()
  })

  test('a disabled field without a reason keeps its hint', () => {
    const option = { ...numberSelect, disabledHint: undefined }
    render(<SettingField option={option} value={0} onChange={() => {}} disabled />)

    expect(screen.getByRole('combobox', { name: 'Step' })).toHaveAccessibleDescription('Applies to every entry.')
  })

  test('a disabled checkbox is disabled and described by the reason', () => {
    render(<SettingField option={checkbox} value onChange={() => {}} disabled />)

    expect(screen.getByRole('checkbox', { name: 'Tidy' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Tidy' })).toHaveAccessibleDescription('Not now.')
  })

  test('a field without any hint has no description', () => {
    render(<SettingField option={{ ...numberSelect, hint: undefined, disabledHint: undefined }} value={0} onChange={() => {}} />)

    expect(screen.getByRole('combobox', { name: 'Step' })).toHaveAccessibleDescription('')
  })

  test.each([[false], [true]])('has no detectable accessibility violations, disabled: %s', async (disabled) => {
    const { container } = render(<SettingField option={numberSelect} value={15} onChange={() => {}} disabled={disabled} />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
