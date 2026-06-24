import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 53217,
    proxy: {
      '/api': 'http://127.0.0.1:43217',
      '/canvas-events': 'http://127.0.0.1:43217',
      '/assets': 'http://127.0.0.1:43217',
      '/page-assets': 'http://127.0.0.1:43217',
    },
  },
})
