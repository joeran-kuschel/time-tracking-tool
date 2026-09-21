import { configureAxe } from 'vitest-axe'

// jsdom can't render colors, so contrast has to be checked in a real browser
export const axe = configureAxe({
  rules: { 'color-contrast': { enabled: false } }
})
