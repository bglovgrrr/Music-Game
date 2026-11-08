import { useState, useSyncExternalStore } from 'react'
import { useSpotifyConnected } from '@/hooks/use-spotify'
import { isIOS, localPlayerUsable, onPhoneSpotify, phoneSpotify } from '@/music/spotify-player'
import { safeStorage } from '@/lib/utils'

const PREVIEWS_KEY = 'sideb:music-previews'

/**
 * The host's music, set up before the game can start. Ready means either:
 *  - Spotify is connected and can play here (on an iPhone: the Spotify app is open), or
 *  - the host chose 30-second previews on purpose.
 */
export function useMusicReady() {
  const connected = useSpotifyConnected()
  const phone = useSyncExternalStore(onPhoneSpotify, phoneSpotify, phoneSpotify)
  const [previews, setPreviewsState] = useState(() => safeStorage.get(PREVIEWS_KEY) === '1')
  const setPreviews = (v: boolean) => {
    safeStorage.set(PREVIEWS_KEY, v ? '1' : '')
    setPreviewsState(v)
  }
  const needsPhoneApp = isIOS() && !localPlayerUsable()
  const spotifyReady = connected && (!needsPhoneApp || phone === 'awake')
  return { connected, phone, needsPhoneApp, previews: previews && !connected, ready: spotifyReady || (previews && !connected), setPreviews }
}
