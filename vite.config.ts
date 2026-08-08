import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages uses /han-notes-app/ base path; Tauri uses /
  base: command === 'build' && !process.env.TAURI_ENV_PLATFORM
    ? '/han-notes-app/'
    : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',  // Show update prompt, don't auto-reload
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      workbox: {
        // Cache app shell (JS, CSS, HTML) — NOT user data
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
        // Network-first for navigation requests → always get latest HTML
        navigateFallback: 'index.html',
        // Clean old caches on activate
        cleanupOutdatedCaches: true,
        // Skip waiting to activate new SW immediately when user accepts
        skipWaiting: false,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Google Fonts (if used)
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'H.A.N. — Hierarchical Adaptive Notebook',
        short_name: 'H.A.N.',
        description: 'A local-first, privacy-focused note-taking app with task tracking, decision logging, and wiki-links.',
        start_url: './',
        display: 'standalone',
        background_color: '#0a0a0f',
        theme_color: '#4F46E5',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
}))
