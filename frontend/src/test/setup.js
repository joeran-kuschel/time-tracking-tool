import '@testing-library/jest-dom/vitest'
import * as axeMatchers from 'vitest-axe/matchers'
import { afterEach, beforeEach, expect } from 'vitest'
import { cleanup } from '@testing-library/react'
import { activateLocale } from '../i18n'

expect.extend(axeMatchers)

// Tests run in German unless they switch, which also checks the German catalog
beforeEach(() => {
  if (typeof window === 'undefined') return // tests in the node environment
  window.localStorage.clear()
  activateLocale('de')
})

afterEach(() => {
  cleanup()
})
