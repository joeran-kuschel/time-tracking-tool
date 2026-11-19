import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { lingui } from '@lingui/vite-plugin'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    lingui({ macroTransform: true }),
    tailwindcss()
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: {
    port: 5173,
    // Only this machine can open the dev server. Inside a container, start it with --host 0.0.0.0 on purpose.
    host: 'localhost'
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  test: {
    environment: 'jsdom',
    reporters: ['default', './tests/support/timingReporter.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: './tests/support/setup.js'
  }
})
