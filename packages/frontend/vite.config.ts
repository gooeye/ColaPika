import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 80,
    host: true
  },
  preview: {
    port: 80,
    host: true
  },
  define: {
    'import.meta.env.VITE_BACKEND_URL': JSON.stringify(process.env.VITE_BACKEND_URL || 'http://localhost:3001'),
    'import.meta.env.VITE_BACKEND_WS_URL': JSON.stringify(process.env.VITE_BACKEND_WS_URL || 'ws://localhost:3001')
  }
})
