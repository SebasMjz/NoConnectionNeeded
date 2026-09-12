import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
  base: '/',
  define: {
    'global': 'globalThis',
  },
  build: {
    rollupOptions: {
      output: {
        crossOriginLoading: false
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    cors: true,
  },
})

