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
      // Google/GitHub sign-in runs on the gateway. These paths are proxied narrowly so the app's own
      // /login and /oauth2/success pages are still served by Vite.
      '/oauth2/authorization': 'http://localhost:8080',
      '/login/oauth2': 'http://localhost:8080',
    },
  },
})
