import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build:preview` makes one self-contained HTML file (demo mode),
// used to preview the app inside the Claude app.
export default defineConfig(({ mode }) => {
  const preview = mode === 'preview'
  return {
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    build: preview ? { outDir: 'dist-preview' } : undefined,
    plugins: [
      react(),
      tailwindcss(),
      preview
        ? viteSingleFile()
        : VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
              name: 'Side B',
              short_name: 'Side B',
              description: 'A music storytelling game to play with friends',
              theme_color: '#f6f5fa',
              background_color: '#f6f5fa',
              display: 'standalone',
              start_url: '/',
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
          }),
    ],
  }
})
