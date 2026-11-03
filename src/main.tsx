import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { handleSpotifyCallback } from './music/spotify'

const root = createRoot(document.getElementById('root')!)

function SpotifyDone() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="grid gap-2">
        <p className="font-display text-2xl">Connected to Spotify</p>
        <p className="text-muted-foreground">You can close this window and go back to Side B.</p>
      </div>
    </div>
  )
}

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
  })
