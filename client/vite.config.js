import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy REST API calls to the backend during local development
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
})
