import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    // In development the frontend talks to Django through this proxy, so the
    // browser sees one origin and no CORS setup is needed locally.
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
  optimizeDeps: {
    // Only imported by the lazy map chunk; pre-bundle them at server start so
    // the dev server never has to re-optimise mid-session (504 "Outdated Optimize Dep").
    include: ['maplibre-gl', 'react-map-gl/maplibre'],
  },
  build: {
    // The map chunk (~1.1 MB, ~310 KB gzipped) is almost entirely MapLibre GL.
    // It is lazy-loaded after the form renders, so it does not delay first paint.
    // The limit sits just above it so any *new* oversized chunk still warns.
    chunkSizeWarningLimit: 1200,
  },
})
