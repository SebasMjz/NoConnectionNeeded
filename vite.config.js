import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
  define: {
    'global': 'globalThis',
  },
  // Externalize CommonJS modules that don't bundle well
  build: {
    rollupOptions: {
      external: ['ethers'],
      output: {
        globals: {
          ethers: 'ethers'
        }
      }
    },
    commonjsOptions: {
      include: [/ethers/, /node_modules/]
    }
  },
  optimizeDeps: {
    include: ['ethers']
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    cors: true,
  },
})
