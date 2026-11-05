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
      ...(preview ? [viteSingleFile()] : []),
      VitePWA({
            // The preview build is a single file without a service worker.
            disable: preview,
            // We register it ourselves (src/lib/pwa.ts) to apply updates promptly.
            injectRegister: false,
            registerType: 'prompt',
            workbox: {
              navigateFallbackDenylist: [/^\/api\//],
              cleanupOutdatedCaches: true,
            },
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
              name: 'Mixtape Memories',
              short_name: 'Mixtape',
              description: 'A music storytelling game to play with friends',
              theme_color: '#24170f',
              background_color: '#24170f',
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
