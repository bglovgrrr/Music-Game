/**
 * Spotify sign-in for the host (Authorization Code + PKCE: no server, no secret).
 * Used to play full songs on the host's Spotify and to save playlists.
 *
 * Setup: a Spotify developer app with this site's address (e.g.
 * https://music-game-virid.vercel.app/) as a Redirect URI, and its Client ID in
 * VITE_SPOTIFY_CLIENT_ID. In Development Mode the app owner needs Premium and each
 * person who signs in must be added under User Management (max 5).
 */
import { safeStorage } from '@/lib/utils'

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined
export const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-modify-private',
  'playlist-modify-public',
  // In-page player (Web Playback SDK)
  'streaming',
  'user-read-email',
  'user-read-private',
]
const TOKEN_KEY = 'sideb:spotify-token'
const PENDING_KEY = 'sideb:spotify-pending'

export const spotifyConfigured = !!CLIENT_ID && import.meta.env.MODE !== 'preview'

export type SpotifyErrorCode = 'not_connected' | 'no_device' | 'premium' | 'forbidden' | 'rate_limited' | 'other'

export class SpotifyError extends Error {
  readonly code: SpotifyErrorCode
  constructor(message: string, code: SpotifyErrorCode = 'other') {
    super(message)
    this.code = code
  }
}

export type StoredToken = { access_token: string; refresh_token?: string; expires_at: number; scope?: string }

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** Re-render when the connection changes (also in other tabs). */
export function onSpotifyChange(l: () => void) {
  listeners.add(l)
  const onStorage = (e: StorageEvent) => e.key === TOKEN_KEY && l()
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(l)
    window.removeEventListener('storage', onStorage)
  }
}

function read(): StoredToken | null {
  try {
    return JSON.parse(safeStorage.get(TOKEN_KEY) || 'null') as StoredToken | null
  } catch {
    return null
  }
}

function save(t: StoredToken | null) {
  safeStorage.set(TOKEN_KEY, t ? JSON.stringify(t) : '')
  emit()
}

const hasScopes = (t: StoredToken) => !t.scope || SCOPES.every((s) => t.scope!.split(' ').includes(s))

/** Connected on this device with all the permissions we need. */
export function isSpotifyConnected() {
  const t = read()
  return !!t && (!!t.refresh_token || t.expires_at > Date.now()) && hasScopes(t)
}

export function disconnectSpotify() {
  save(null)
}

async function tokenRequest(body: Record<string, string>): Promise<StoredToken> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  if (!res.ok) throw new SpotifyError('Spotify sign-in expired. Connect again.', 'not_connected')
  const d = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope?: string }
  return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + d.expires_in * 1000, scope: d.scope }
}

let refreshing: Promise<StoredToken> | null = null

/** A valid access token, refreshed when needed. Null when not connected. */
export async function getAccessToken(): Promise<string | null> {
  const t = read()
  if (!t || !hasScopes(t)) return null
  if (t.expires_at > Date.now() + 60_000) return t.access_token
  if (!t.refresh_token || !CLIENT_ID) return null
  refreshing ??= tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: CLIENT_ID })
    .then((n) => {
      const merged = { ...n, refresh_token: n.refresh_token ?? t.refresh_token }
      save(merged)
      return merged
    })
    .catch((err) => {
      save(null)
      throw err
    })
    .finally(() => {
      refreshing = null
    })
  return (await refreshing).access_token
}

const redirectUri = () => `${window.location.origin}/`
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/**
 * Sign in to Spotify in a new window/tab. Resolves once the user approves.
 * That window (our own site, at the redirect URI) finishes via handleSpotifyCallback()
 * and hands the token back through localStorage.
 */
export async function connectSpotify(): Promise<void> {
  if (isSpotifyConnected()) return
  if (!CLIENT_ID) throw new SpotifyError('Spotify is not set up for this app yet.')
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)))
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)))
  safeStorage.set(PENDING_KEY, JSON.stringify({ verifier, state }))
  const url = new URL('https://accounts.spotify.com/authorize')
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES.join(' '),
    redirect_uri: redirectUri(),
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  }).toString()

  const popup = window.open(url.toString(), 'sideb-spotify', 'width=480,height=720')
  if (!popup) throw new SpotifyError('Your browser blocked the Spotify window. Allow pop-ups and try again.')

  await new Promise<void>((resolve, reject) => {
    const started = Date.now()
    const timer = setInterval(() => {
      if (isSpotifyConnected()) {
        clearInterval(timer)
        resolve()
      } else if (Date.now() - started > 5 * 60_000) {
        clearInterval(timer)
        reject(new SpotifyError('Spotify sign-in timed out. Try again.'))
      }
    }, 500)
  })
}

/**
 * Runs on page load. If this window is Spotify sending the user back, finish signing in
 * and return true (the app then shows "you can close this window").
 */
export async function handleSpotifyCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  const error = params.get('error')
  const pendingRaw = safeStorage.get(PENDING_KEY)
  if (!pendingRaw || (!code && !error) || !state) return false
  let pending: { verifier: string; state: string }
  try {
    pending = JSON.parse(pendingRaw)
  } catch {
    return false
  }
  if (pending.state !== state) return false
  safeStorage.set(PENDING_KEY, '')
  window.history.replaceState(null, '', '/')
  if (error || !code || !CLIENT_ID) return true
  try {
    save(await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), client_id: CLIENT_ID, code_verifier: pending.verifier }))
  } catch {
    /* the game window will time out and say so */
  }
  return true
}

/** Call the Spotify Web API as the signed-in host. Maps common errors to plain words. */
export async function spotifyApi<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken()
  if (!token) throw new SpotifyError('Connect Spotify first.', 'not_connected')
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
  })
  if (res.status === 204 || res.status === 202) return undefined as T
  let body: { error?: { message?: string; reason?: string } } | undefined
  try {
    body = await res.clone().json()
  } catch {
    body = undefined
  }
  if (res.ok) return body as T
  const reason = body?.error?.reason ?? ''
  if (res.status === 401) {
    save(null)
    throw new SpotifyError('Spotify sign-in expired. Connect again.', 'not_connected')
  }
  if (res.status === 404 && /NO_ACTIVE_DEVICE/i.test(reason + (body?.error?.message ?? '')))
    throw new SpotifyError('Spotify isn’t open anywhere. Open the Spotify app on the speaker phone, then tap play again.', 'no_device')
  if (res.status === 404) throw new SpotifyError('Spotify couldn’t find a device to play on. Open the Spotify app, then tap play again.', 'no_device')
  if (res.status === 403 && /PREMIUM/i.test(reason))
    throw new SpotifyError('Playing full songs needs Spotify Premium on the host account.', 'premium')
  if (res.status === 403)
    throw new SpotifyError(
      'Spotify refused. Make sure this Spotify account is added under User Management in the Spotify developer dashboard.',
      'forbidden',
    )
  if (res.status === 429) throw new SpotifyError('Spotify is busy. Wait a moment and try again.', 'rate_limited')
  throw new SpotifyError(`Spotify error (${res.status}).`)
}
