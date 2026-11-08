/** Remote control for the host's Spotify (phone app, desktop app, or Spotify Connect speaker). */
import { SpotifyError, spotifyApi } from './spotify-auth'
import { safeStorage } from '@/lib/utils'
import { ensureLocalPlayer, localDeviceId } from './spotify-sdk'
import { logSpotify } from './spotify-log'

export type SpotifyDevice = { id: string; name: string; type: string; is_active: boolean }
export type SpotifyPlayback = {
  isPlaying: boolean
  progressMs: number
  uri?: string
  durationMs?: number
  device?: string
  deviceId?: string
  contextUri?: string
}

const DEVICE_KEY = 'sideb:spotify-device'
/** Stored choice meaning "Mixtape Memories' own in-page player" (its device id changes every visit). */
export const LOCAL = 'local'
export const chosenDeviceId = () => safeStorage.get(DEVICE_KEY) || null
export const chooseDevice = (id: string | null) => safeStorage.set(DEVICE_KEY, id ?? '')

/** iPhone/iPad: Spotify's in-page player starts there but Spotify never reaches it (tested Nov 2026). */
export const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

const LOCAL_BROKEN_KEY = 'sideb:local-player-broken'
/** Mixtape Memories' built-in player can be used on this browser (not iOS, and it hasn't failed here before). */
export const localPlayerUsable = () => !isIOS() && safeStorage.get(LOCAL_BROKEN_KEY) !== '1'
const markLocalBroken = () => safeStorage.set(LOCAL_BROKEN_KEY, '1')

/** Phones put a paused Spotify app to sleep; we keep those busy with silence between songs. */
export const needsKeepAlive = (d: Pick<SpotifyDevice, 'type'>) => /smartphone|tablet/i.test(d.type)

/** Silence used to keep a phone's Spotify awake ("30 Minutes of Silence" by Silenzio). */
export const SILENCE = { uri: 'spotify:track:0XycH5D4znCfJIBeYt3upG', album: 'spotify:album:2d71KC0acijowAr9j9xInR' }
export const isSilence = (pb: SpotifyPlayback | null) => !!pb && (pb.uri === SILENCE.uri || pb.contextUri === SILENCE.album)

let keepAliveId: string | null = null
/** The phone being kept awake, or null. Set by the host's game screen. */
export const setKeepAliveDevice = (id: string | null) => {
  keepAliveId = id
}
export const keepAliveDevice = () => keepAliveId

/**
 * Which device the keep-alive should look after: the remembered one if it's still listed;
 * otherwise (no built-in player on this browser, e.g. iPhone) this phone's Spotify app.
 */
export function keepAliveTarget(devices: SpotifyDevice[], picked: string | null, localUsable: boolean): SpotifyDevice | undefined {
  const remembered = devices.find((d) => d.id === picked)
  if (remembered) return remembered
  return localUsable ? undefined : devices.find(needsKeepAlive)
}

/**
 * Is Spotify reachable on this phone? 'asleep' = this is an iPhone host and Spotify isn't
 * running (it isn't on the account's device list), so nothing can play until it's opened.
 */
export type PhoneSpotify = 'unknown' | 'awake' | 'asleep'
let phoneState: PhoneSpotify = 'unknown'
const phoneListeners = new Set<() => void>()
export const phoneSpotify = () => phoneState
export function setPhoneSpotify(next: PhoneSpotify) {
  if (next === phoneState) return
  phoneState = next
  phoneListeners.forEach((l) => l())
}
export function onPhoneSpotify(l: () => void) {
  phoneListeners.add(l)
  return () => phoneListeners.delete(l)
}

let wokeAt = 0
/** Open the Spotify app (must run inside a tap). Coming back soon after counts as "just woken". */
export function wakeSpotify() {
  wokeAt = Date.now()
  window.location.href = 'spotify:'
}
export const justWoke = () => Date.now() - wokeAt < 3 * 60_000
export const clearWoke = () => {
  wokeAt = 0
}

export async function listDevices(): Promise<SpotifyDevice[]> {
  const d = await spotifyApi<{ devices: SpotifyDevice[] }>('/me/player/devices')
  return (d?.devices ?? []).filter((x) => x.id)
}

/** The device to play on: the one picked in Mixtape Memories, else Spotify's active one, else the first available. */
async function targetDevice(): Promise<SpotifyDevice> {
  const picked = chosenDeviceId()
  // Default: Mixtape Memories' own in-page player (no Spotify app needed), where it works.
  if ((!picked || picked === LOCAL) && localPlayerUsable()) {
    const id = localDeviceId() ?? (await ensureLocalPlayer())
    if (id) return { id, name: 'this device', type: 'Computer', is_active: true }
  }
  const devices = await listDevices()
  if (!devices.length) {
    throw new SpotifyError(isIOS() ? 'Spotify isn’t open on this phone. Tap “Open Spotify”, then come right back.' : 'Spotify isn’t open anywhere. Open it on this device (or a speaker), then tap play again.', 'no_device')
  }
  return (
    devices.find((d) => d.id === picked) ??
    devices.find((d) => d.is_active) ??
    (isIOS() ? devices.find(needsKeepAlive) : undefined) ??
    devices[0]
  )
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
 * (seen with Mixtape Memories' app in Nov 2026: player ends up empty with controls disallowed).
 * When the song ends, the game pauses Spotify before the next album track gets far.
 */
export async function playTrack(uri: string, positionMs: number, albumUri?: string): Promise<SpotifyDevice> {
  const device = await targetDevice()
  const position_ms = Math.max(0, Math.round(positionMs))
  const album = await albumOf(uri, albumUri)
  const body = JSON.stringify(album ? { context_uri: album, offset: { uri }, position_ms } : { uris: [uri], position_ms })
  const play = () => spotifyApi(`/me/player/play${q(device.id)}`, { method: 'PUT', body })
  const isLocal = device.id === localDeviceId()
  let revived = false
  for (let attempt = 0; ; attempt++) {
    try {
      await play()
      // Songs shouldn't loop (the silence does); harmless if it fails.
      void setRepeat('off', device.id)
      return device
    } catch (err) {
      // A phone's Spotify app that just dozed off: hand playback to it with play=true, which
      // usually wakes it, then try once more. (Fully asleep apps still need "Wake up Spotify".)
      if (!isLocal && !revived && err instanceof SpotifyError && err.code === 'no_device') {
        revived = true
        if (await revive(device.id)) continue
      }
      // A freshly started built-in player can take a few seconds before Spotify knows it.
      // Switch playback to it explicitly, wait, and try again.
      if (!(isLocal && err instanceof SpotifyError && err.code === 'no_device') || attempt >= 3) {
        if (isLocal && err instanceof SpotifyError && err.code === 'no_device') {
          // The built-in player doesn't work on this browser: remember that and use a Spotify app/speaker instead.
          markLocalBroken()
          return playTrack(uri, positionMs, albumUri)
        }
        throw err
      }
      await spotifyApi('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [device.id], play: false }) }).catch(() => {})
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)))
    }
  }
}

/** Spotify's repeat mode on a device: 'context' loops the album/playlist, 'off' doesn't. */
async function setRepeat(state: 'off' | 'context' | 'track', deviceId: string) {
  await spotifyApi(`/me/player/repeat?state=${state}&device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' }).catch(() => {})
}

/** Hand playback to a device that's still listed, asking it to play. True if it's listed. */
async function revive(deviceId: string): Promise<boolean> {
  const listed = (await listDevices().catch(() => [])).some((d) => d.id === deviceId)
  if (!listed) return false
  logSpotify('no active device: handing playback back to the phone and retrying')
  await spotifyApi('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play: true }) }).catch(() => {})
  await new Promise((r) => setTimeout(r, 800))
  return true
}

/**
 * Play silence on the kept-awake phone (instead of pausing, which lets iOS put Spotify to
 * sleep), on repeat, so it keeps "playing" even while the host's phone is locked.
 */
export async function playSilence() {
  if (!keepAliveId) return
  const id = keepAliveId
  const play = () =>
    spotifyApi(`/me/player/play?device_id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ context_uri: SILENCE.album, offset: { uri: SILENCE.uri }, position_ms: 0 }),
    })
  try {
    await play()
  } catch (err) {
    if (!(err instanceof SpotifyError && err.code === 'no_device') || !(await revive(id))) throw err
    await play()
  }
  await setRepeat('context', id)
}

/** Stop the song. On a kept-awake phone this switches to silence so Spotify stays awake. */
export async function pausePlayback() {
  try {
    if (keepAliveId) {
      await playSilence()
      return
    }
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
  const d = await spotifyApi<{
    is_playing: boolean
    progress_ms: number | null
    item?: { uri: string; duration_ms: number }
    device?: { id: string; name: string }
    context?: { uri?: string } | null
  }>('/me/player')
  if (!d) return null
  return {
    isPlaying: d.is_playing,
    progressMs: d.progress_ms ?? 0,
    uri: d.item?.uri,
    durationMs: d.item?.duration_ms,
    device: d.device?.name,
    deviceId: d.device?.id,
    contextUri: d.context?.uri ?? undefined,
  }
}
