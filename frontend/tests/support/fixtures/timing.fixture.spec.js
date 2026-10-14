// Run by timingReporter.test.js in a child Vitest process, never by the normal test run (its .spec.js name is not in the `include` of vite.config.js).
import { describe, expect, it } from 'vitest'

it('top level', () => {})

describe('group', () => {
  describe('inner group', () => {
    it('nested', () => {})
  })
  it.skip('skipped', () => {})
  it('fails', () => { expect(1).toBe(2) })
})
