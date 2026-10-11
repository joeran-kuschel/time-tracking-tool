import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { lingui } from '@lingui/vite-plugin'

export default defineConfig({
  plugins: [
    react({ babel: { plugins: ['@lingui/babel-plugin-lingui-macro'] } }),
    lingui()
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: {
    port: 5173,
    host: '0.0.0.0'
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
