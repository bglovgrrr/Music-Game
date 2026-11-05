/**
 * Mixtape Memories as its own Spotify speaker (Spotify Web Playback SDK).
 *
 * The host's browser registers a Spotify Connect device called "Mixtape Memories (this device)"
 * and plays full songs inside the page: no Spotify app to open or keep awake. Needs
 * Spotify Premium and the `streaming` scope. On iOS, activateElement() must run during
 * a tap before audio can start.
 */
import { getAccessToken } from './spotify-auth'
import { logSpotify } from './spotify-log'

type SdkPlayer = {
  connect(): Promise<boolean>
  disconnect(): void
  activateElement(): Promise<void>
  addListener(event: string, cb: (arg: Record<string, unknown>) => void): boolean
}
declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void
    Spotify?: { Player: new (opts: { name: string; getOAuthToken: (cb: (t: string) => void) => void; volume?: number }) => SdkPlayer }
  }
}

export const LOCAL_PLAYER_NAME = 'Mixtape Memories (this device)'

let player: SdkPlayer | null = null
let deviceId: string | null = null
let problem: string | null = null
let starting: Promise<string | null> | null = null
let readyWaiters: ((id: string | null) => void)[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const localDeviceId = () => deviceId
export const localPlayerProblem = () => problem
export function onLocalPlayer(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

function loadSdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve()
  return new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    const s = document.createElement('script')
    s.src = 'https://sdk.scdn.co/spotify-player.js'
    s.async = true
    s.onerror = () => reject(new Error('Couldn’t load Spotify’s player'))
    document.head.appendChild(s)
  })
}

function settle(id: string | null) {
  const waiters = readyWaiters
  readyWaiters = []
  waiters.forEach((w) => w(id))
}

function waitForReady(ms: number) {
  return new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => resolve(deviceId), ms)
    readyWaiters.push((id) => {
      clearTimeout(timer)
      resolve(id)
    })
  })
}

function createPlayer(): SdkPlayer {
  const p = new window.Spotify!.Player({
    name: LOCAL_PLAYER_NAME,
    getOAuthToken: (cb) => void getAccessToken().then((t) => t && cb(t)),
    volume: 1,
  })
  p.addListener('ready', (e) => {
    deviceId = String(e.device_id)
    problem = null
    logSpotify(`built-in player ready (${deviceId.slice(0, 6)}…)`)
    emit()
    settle(deviceId)
  })
  p.addListener('not_ready', () => {
    logSpotify('built-in player went offline')
    deviceId = null
    emit()
  })
  const fail = (msg: string) => (e: Record<string, unknown>) => {
    problem = `${msg}${e?.message ? ` (${String(e.message)})` : ''}`
    logSpotify(`built-in player: ${problem}`)
    emit()
    settle(null)
  }
  p.addListener('initialization_error', fail('This browser can’t play Spotify inside the page'))
  p.addListener('authentication_error', fail('Spotify sign-in needs to be refreshed. Disconnect and connect again'))
  p.addListener('account_error', fail('Playing inside Mixtape Memories needs Spotify Premium'))
  p.addListener('playback_error', (e) => logSpotify(`built-in player playback error: ${String(e?.message ?? '')}`))
  p.addListener('autoplay_failed', () => {
    problem = 'Tap anywhere on this screen, then play again (the browser blocked sound).'
    logSpotify('built-in player: autoplay blocked')
    emit()
  })
  return p
}

/** Start (or reconnect) the in-page player; resolves with its device id, or null if it can't run here. */
export function ensureLocalPlayer(): Promise<string | null> {
  if (deviceId) return Promise.resolve(deviceId)
  starting ??= (async () => {
    try {
      await loadSdk()
      player ??= createPlayer()
      const ready = waitForReady(15_000)
      const ok = await player.connect()
      if (!ok) logSpotify('built-in player: connect() returned false')
      return await ready
    } catch (err) {
      problem = (err as Error).message
      emit()
      return null
    } finally {
      starting = null
    }
  })()
  return starting
}

/** Call from a tap: lets the in-page player make sound later (required on iOS). */
export function activateLocalPlayer() {
  void player?.activateElement().catch(() => {})
}

export function stopLocalPlayer() {
  player?.disconnect()
  player = null
  deviceId = null
  emit()
}
