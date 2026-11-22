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

  describe('a decimal field', () => {
    const decimal = { name: 'rate', type: 'decimal', label: msg`Test amount`, hint: msg`Applies to new projects.` }

    test('shows the saved number with two decimals in the language, and an empty field for null', () => {
      const { rerender } = render(<SettingField option={decimal} value={80} onChange={() => {}} />)
      expect(screen.getByRole('textbox', { name: 'Test amount' })).toHaveValue('80,00')

      rerender(<SettingField option={decimal} value={null} onChange={() => {}} />)
      expect(screen.getByRole('textbox', { name: 'Test amount' })).toHaveValue('')
    })

    test('shows 0 as 0,00, not as empty', () => {
      render(<SettingField option={decimal} value={0} onChange={() => {}} />)

      expect(screen.getByRole('textbox', { name: 'Test amount' })).toHaveValue('0,00')
    })

    test('gives the typed text back, and shows a text value as typed', async () => {
      const onChange = vi.fn()
      render(<SettingField option={decimal} value="" onChange={onChange} />)

      await userEvent.type(screen.getByRole('textbox', { name: 'Test amount' }), '9')

      expect(onChange).toHaveBeenCalledWith('9')
    })

    test('asks for the decimal keyboard and is described by its hint', () => {
      render(<SettingField option={decimal} value={null} onChange={() => {}} />)

      const input = screen.getByRole('textbox', { name: 'Test amount' })
      expect(input).toHaveAttribute('inputmode', 'decimal')
      expect(input).toHaveAccessibleDescription('Applies to new projects.')
      expect(input).not.toHaveAttribute('aria-invalid')
    })

    test('an error marks the field invalid and is part of its description', () => {
      render(<SettingField option={decimal} value="abc" onChange={() => {}} error="Not an amount." />)

      const input = screen.getByRole('textbox', { name: 'Test amount' })
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveAccessibleDescription('Applies to new projects. Not an amount.')
      expect(screen.getByRole('alert')).toHaveTextContent('Not an amount.')
    })

    test('can be disabled', () => {
      render(<SettingField option={decimal} value={1} onChange={() => {}} disabled />)

      expect(screen.getByRole('textbox', { name: 'Test amount' })).toBeDisabled()
    })

    test('has no detectable accessibility violations, also with an error', async () => {
      const { container } = render(<SettingField option={decimal} value="x" onChange={() => {}} error="Not an amount." />)

      expect(await axe(container)).toHaveNoViolations()
    })
  })

  describe('a text option', () => {
    const text = { name: 't', type: 'text', label: msg`Test name`, hint: msg`Shown on the report.`, maxLength: 20, autoComplete: 'name' }
    const email = { name: 'e', type: 'email', label: msg`Test email`, autoComplete: 'email' }
    const area = { name: 'a', type: 'textarea', label: msg`Test address`, maxLength: 50, autoComplete: 'street-address' }

    test('shows the text, or an empty field for null, and gives the typed text back', async () => {
      const onChange = vi.fn()
      const { rerender } = render(<SettingField option={text} value={null} onChange={onChange} />)
      const input = screen.getByRole('textbox', { name: 'Test name' })
      expect(input).toHaveValue('')

      await userEvent.type(input, 'J')
      expect(onChange).toHaveBeenCalledWith('J')

      rerender(<SettingField option={text} value="Jana" onChange={onChange} />)
      expect(screen.getByRole('textbox', { name: 'Test name' })).toHaveValue('Jana')
    })

    test('passes the length limit and the autocomplete token on, off when none is set', () => {
      render(<>
        <SettingField option={text} value={null} onChange={() => {}} />
        <SettingField option={{ ...text, label: msg`Plain`, autoComplete: undefined, maxLength: undefined }} value={null} onChange={() => {}} />
      </>)

      expect(screen.getByRole('textbox', { name: 'Test name' })).toHaveAttribute('maxlength', '20')
      expect(screen.getByRole('textbox', { name: 'Test name' })).toHaveAttribute('autocomplete', 'name')
      expect(screen.getByRole('textbox', { name: 'Plain' })).toHaveAttribute('autocomplete', 'off')
      expect(screen.getByRole('textbox', { name: 'Plain' })).not.toHaveAttribute('maxlength')
    })

    test('an email option is an email field', () => {
      render(<SettingField option={email} value="a@b.de" onChange={() => {}} />)

      expect(screen.getByRole('textbox', { name: 'Test email' })).toHaveAttribute('type', 'email')
    })

    test('a textarea keeps the lines and gives them back', async () => {
      const onChange = vi.fn()
      render(<SettingField option={area} value={'Weg 1\n12345 Stadt'} onChange={onChange} />)
      const input = screen.getByRole('textbox', { name: 'Test address' })

      expect(input.tagName).toBe('TEXTAREA')
      expect(input).toHaveValue('Weg 1\n12345 Stadt')

      await userEvent.type(input, '{Enter}')
      expect(onChange).toHaveBeenCalledWith('Weg 1\n12345 Stadt\n')
    })

    test('is described by its hint and its error, and can be disabled', () => {
      render(<SettingField option={text} value="x" onChange={() => {}} error="Too odd." disabled />)

      const input = screen.getByRole('textbox', { name: 'Test name' })
      expect(input).toBeDisabled()
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveAccessibleDescription('Shown on the report. Too odd.')
    })

    test('has no detectable accessibility violations, for every type', async () => {
      const { container } = render(<>
        <SettingField option={text} value="x" onChange={() => {}} error="Too odd." />
        <SettingField option={email} value="a@b.de" onChange={() => {}} />
        <SettingField option={area} value="x" onChange={() => {}} />
      </>)

      expect(await axe(container)).toHaveNoViolations()
    })
  })
})
