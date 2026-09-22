/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      // Colors of the design (see documentation/ui/design.md); text colors reach 4.5:1 on paper and surface
      colors: {
        paper: '#F4F2EC',
        surface: '#FFFFFF',
        ink: '#1D1C1A',
        muted: '#5E5A52',
        line: { DEFAULT: '#E2DED4', soft: '#ECE8DF', strong: '#8A8477' },
        accent: { DEFAULT: '#0E5C58', dark: '#0A4441', soft: '#E3EFEC' },
        danger: { DEFAULT: '#B42318', dark: '#8F1C13', soft: '#FDECEA', line: '#F3C4BF' },
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
