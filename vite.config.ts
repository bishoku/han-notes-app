import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages uses /han-notes-app/ base path; Tauri uses /
  base: command === 'build' && !process.env.TAURI_ENV_PLATFORM
    ? '/han-notes-app/'
    : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
}))
