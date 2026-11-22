import '@testing-library/jest-dom/vitest'
import * as axeMatchers from 'vitest-axe/matchers'
import { afterEach, beforeEach, expect } from 'vitest'
import { cleanup } from '@testing-library/react'
import { activateLocale } from '@/i18n'

expect.extend(axeMatchers)

// jsdom has <dialog> but no showModal() or close(); the modal behavior itself is checked in a browser
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

// jsdom has no object URLs (the logo preview and downloads use them); each gets its own address
if (typeof URL !== 'undefined' && !URL.createObjectURL) {
  let count = 0
  URL.createObjectURL = () => `blob:test/${++count}`
  URL.revokeObjectURL = () => {}
}

// Tests run in German unless they switch, which also checks the German catalog
beforeEach(() => {
  if (typeof window === 'undefined') return // tests in the node environment
  window.localStorage.clear()
  activateLocale('de')
})

afterEach(() => {
  cleanup()
})
