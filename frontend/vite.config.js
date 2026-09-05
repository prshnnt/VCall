import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // We write our own service worker (push + notificationclick need
      // custom logic that the auto-generated one doesn't cover) and just
      // ask the plugin to inject the precache manifest into it.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectRegister: false, // we register it ourselves in main.jsx
      manifest: {
        name: 'CallChat',
        short_name: 'CallChat',
        description: 'Minimal WebRTC calling and chat',
        start_url: '/',
        display: 'standalone',
        background_color: '#0d0f14',
        theme_color: '#0d6efd',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // Keep the precache list small/simple for this minimal app.
        globPatterns: ['**/*.{js,css,html,png,svg}'],
      },
      devOptions: {
        // Lets the service worker run under `npm run dev` too, so push
        // notifications can be tested without a full production build.
        enabled: true,
        type: 'module',
      },
    }),
  ],
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
