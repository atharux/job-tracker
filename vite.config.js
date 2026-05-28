import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['pdfjs-dist'],
    exclude: ['playwright', 'playwright-core', '@playwright/test'],
  },
  build: {
    commonjsOptions: {
      include: [/pdfjs-dist/, /node_modules/]
    }
  }
})
