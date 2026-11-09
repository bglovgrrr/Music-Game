import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { execSync } from 'node:child_process'
import pkg from './package.json' with { type: 'json' }

/** Short id of the commit being built (Vercel provides it; locally ask git). */
function commit() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
  if (sha) return sha.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}

// `npm run build:preview` makes one self-contained HTML file (demo mode),
// used to preview the app inside the Claude app.
export default defineConfig(({ mode }) => {
  const preview = mode === 'preview'
  return {
    resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
    // Shown in the top left so it's easy to tell which release a phone is running.
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_COMMIT__: JSON.stringify(commit()),
      __APP_BUILT__: JSON.stringify(new Date().toISOString()),
    },
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
              navigateFallbackDenylist: [/^\/api\//, /^\/w\//],
              cleanupOutdatedCaches: true,
            },
            includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'theme-init.js'],
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
