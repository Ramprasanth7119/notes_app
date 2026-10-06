import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin API in development, like the Vercel rewrite in production
    // (vercel.json), so the httpOnly auth cookie is first-party.
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
})
