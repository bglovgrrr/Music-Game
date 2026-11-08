import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SpotifyDone } from './components/spotify-done'
import { setupPwa } from './lib/pwa'
import { handleSpotifyCallback } from './music/spotify-auth'
import { migrateStorageKeys } from './lib/utils'

migrateStorageKeys()

const root = createRoot(document.getElementById('root')!)

// If this window is Spotify sending us back after sign-in, finish that instead of starting the game.
handleSpotifyCallback()
  .catch(() => false)
  .then((wasCallback) => {
    if (wasCallback) {
      root.render(<SpotifyDone />)
      setTimeout(() => window.close(), 800)
      return
    }
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    setupPwa()
  })
