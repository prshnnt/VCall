import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../backend/webapp',
    emptyOutDir: true,
  },
  server: {
    // During `npm run dev`, proxy API/WS calls to the FastAPI backend
    // running on 8000 so you don't need CORS juggling in dev either.
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      },
    },
  },
})
