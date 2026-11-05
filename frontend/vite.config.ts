import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the frontend talks to Django through this proxy, so the
// browser sees one origin and no CORS setup is needed locally.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
