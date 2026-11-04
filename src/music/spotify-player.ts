/** Remote control for the host's Spotify (phone app, desktop app, or Spotify Connect speaker). */
import { SpotifyError, spotifyApi } from './spotify-auth'
import { safeStorage } from '@/lib/utils'

export type SpotifyDevice = { id: string; name: string; type: string; is_active: boolean }
export type SpotifyPlayback = { isPlaying: boolean; progressMs: number; uri?: string; durationMs?: number; device?: string }

const DEVICE_KEY = 'sideb:spotify-device'
export const chosenDeviceId = () => safeStorage.get(DEVICE_KEY) || null
export const chooseDevice = (id: string | null) => safeStorage.set(DEVICE_KEY, id ?? '')

export async function listDevices(): Promise<SpotifyDevice[]> {
  const d = await spotifyApi<{ devices: SpotifyDevice[] }>('/me/player/devices')
  return (d?.devices ?? []).filter((x) => x.id)
}

/** The device to play on: the one picked in Side B, else Spotify's active one, else the first available. */
async function targetDevice(): Promise<SpotifyDevice> {
  const devices = await listDevices()
  if (!devices.length) {
    throw new SpotifyError('Open the Spotify app on the speaker phone (play any song for a second), then tap play again.', 'no_device')
  }
  const picked = chosenDeviceId()
  return devices.find((d) => d.id === picked) ?? devices.find((d) => d.is_active) ?? devices[0]
}

const q = (deviceId?: string) => (deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '')

const albumCache = new Map<string, string | null>()

/** The album a song belongs to (looked up once if the search result didn't include it). */
async function albumOf(uri: string, known?: string): Promise<string | null> {
  if (known) return known
  if (albumCache.has(uri)) return albumCache.get(uri)!
  try {
    const t = await spotifyApi<{ album?: { uri?: string } }>(`/tracks/${uri.split(':').pop()}`)
    albumCache.set(uri, t?.album?.uri ?? null)
  } catch {
    albumCache.set(uri, null)
  }
  return albumCache.get(uri)!
}

/**
 * Play one song from a position. Returns the device used.
 *
 * Songs are started *from their album* (context_uri + offset). Playing a bare track
 * (`uris: [...]`) is accepted by Spotify but plays nothing for Development Mode apps
 * (seen with Side B's app in Nov 2026: player ends up empty with controls disallowed).
 * When the song ends, the game pauses Spotify before the next album track gets far.
 */
export async function playTrack(uri: string, positionMs: number, albumUri?: string): Promise<SpotifyDevice> {
  const device = await targetDevice()
  const position_ms = Math.max(0, Math.round(positionMs))
  const album = await albumOf(uri, albumUri)
  const body = album ? { context_uri: album, offset: { uri }, position_ms } : { uris: [uri], position_ms }
  await spotifyApi(`/me/player/play${q(device.id)}`, { method: 'PUT', body: JSON.stringify(body) })
  return device
}

export async function pausePlayback() {
  try {
    await spotifyApi('/me/player/pause', { method: 'PUT' })
  } catch (err) {
    // Already paused / nothing playing is fine.
    if (err instanceof SpotifyError && err.code === 'no_device') return
    throw err
  }
}

export async function seekTo(positionMs: number) {
  await spotifyApi(`/me/player/seek?position_ms=${Math.max(0, Math.round(positionMs))}`, { method: 'PUT' })
}

export async function getPlayback(): Promise<SpotifyPlayback | null> {
  const d = await spotifyApi<{ is_playing: boolean; progress_ms: number | null; item?: { uri: string; duration_ms: number }; device?: { name: string } }>(
    '/me/player',
  )
  if (!d) return null
  return { isPlaying: d.is_playing, progressMs: d.progress_ms ?? 0, uri: d.item?.uri, durationMs: d.item?.duration_ms, device: d.device?.name }
}
