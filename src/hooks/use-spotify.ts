import { useSyncExternalStore } from 'react'
import { isSpotifyConnected, onSpotifyChange, spotifyConfigured } from '@/music/spotify-auth'

/** Whether this device is connected to Spotify (re-renders when that changes). */
export function useSpotifyConnected() {
  const connected = useSyncExternalStore(onSpotifyChange, isSpotifyConnected, () => false)
  return spotifyConfigured && connected
}
