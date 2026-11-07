import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  server: {
    // Forward API calls to the gateway in development, so the browser sees one origin (no CORS).
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
