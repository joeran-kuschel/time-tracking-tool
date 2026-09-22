// A color from index.css, kept as "r g b" so opacity modifiers like bg-paper/70 still work
const themeColor = (name) => `rgb(var(--color-${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      // Colors of the design (see documentation/ui/design.md), as CSS variables that index.css sets for the light
      // and the dark theme; text colors reach 4.5:1 on paper and surface in both
      colors: {
        paper: themeColor('paper'),
        surface: themeColor('surface'),
        ink: themeColor('ink'),
        muted: themeColor('muted'),
        line: { DEFAULT: themeColor('line'), soft: themeColor('line-soft'), strong: themeColor('line-strong') },
        accent: { DEFAULT: themeColor('accent'), dark: themeColor('accent-dark'), soft: themeColor('accent-soft') },
        danger: { DEFAULT: themeColor('danger'), dark: themeColor('danger-dark'), soft: themeColor('danger-soft'), line: themeColor('danger-line') },
        // Text on accent and danger fills: white in the light theme, near-black in the dark one
        'on-fill': themeColor('on-fill'),
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        serif: ['Newsreader', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
