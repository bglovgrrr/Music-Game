/**
 * "Save to Spotify": signs in with Spotify (Authorization Code + PKCE, no server or secret
 * needed), finds each song on Spotify, and creates a private playlist in the user's account.
 *
 * Setup: create an app at developer.spotify.com, add your site's address (e.g.
 * https://your-app.vercel.app/) as a Redirect URI, and put its Client ID in
 * VITE_SPOTIFY_CLIENT_ID. Spotify limits apps in Development Mode: the app owner needs
 * Premium, and each person who saves playlists must be added under User Management.
 *
 * Uses the endpoints from Spotify's February 2026 Web API changes:
 * POST /v1/me/playlists and POST /v1/playlists/{id}/items.
 */
import type { Track } from '@/game/types'
import { safeStorage } from '@/lib/utils'

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined
const SCOPES = 'playlist-modify-private playlist-modify-public'
const TOKEN_KEY = 'sideb:spotify-token'
const PENDING_KEY = 'sideb:spotify-pending'

export const spotifyAvailable = !!CLIENT_ID && import.meta.env.MODE !== 'preview'

export class SpotifyError extends Error {}

const redirectUri = () => `${window.location.origin}/`

type Token = { access_token: string; expires_at: number }

function savedToken(): Token | null {
  try {
    const t = JSON.parse(safeStorage.get(TOKEN_KEY) || 'null') as Token | null
    return t && t.expires_at > Date.now() + 60_000 ? t : null
  } catch {
    return null
  }
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function pkcePair() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)))
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  return { verifier, challenge: b64url(digest) }
}

/**
 * Sign in to Spotify in a new window. Resolves with a token once the user approves.
 * The other window (our own site, opened at the redirect URI) finishes the sign-in
 * via handleSpotifyCallback() and hands the token back through localStorage.
 */
async function signIn(): Promise<Token> {
  const existing = savedToken()
  if (existing) return existing
  if (!CLIENT_ID) throw new SpotifyError('Spotify is not set up for this app yet.')

  const { verifier, challenge } = await pkcePair()
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)))
  safeStorage.set(PENDING_KEY, JSON.stringify({ verifier, state }))
  const url = new URL('https://accounts.spotify.com/authorize')
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: redirectUri(),
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  }).toString()

  const popup = window.open(url.toString(), 'sideb-spotify', 'width=480,height=720')
  if (!popup) throw new SpotifyError('Your browser blocked the Spotify window. Allow pop-ups and try again.')

  return new Promise<Token>((resolve, reject) => {
    const started = Date.now()
    const timer = setInterval(() => {
      const t = savedToken()
      if (t) {
        clearInterval(timer)
        resolve(t)
      } else if (Date.now() - started > 5 * 60_000) {
        clearInterval(timer)
        reject(new SpotifyError('Spotify sign-in timed out. Try again.'))
      }
    }, 500)
  })
}

/**
 * Runs on page load. If this window is Spotify's redirect back to us, finish signing in,
 * store the token for the game window, and return true (the app shows a "you can close
 * this window" message instead of the game).
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

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: CLIENT_ID,
      code_verifier: pending.verifier,
    }),
  })
  if (res.ok) {
    const data = (await res.json()) as { access_token: string; expires_in: number }
    safeStorage.set(TOKEN_KEY, JSON.stringify({ access_token: data.access_token, expires_at: Date.now() + data.expires_in * 1000 }))
  }
  return true
}

async function api<T>(token: Token, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json', ...init?.headers },
  })
  if (res.status === 401) {
    safeStorage.set(TOKEN_KEY, '')
    throw new SpotifyError('Spotify sign-in expired. Try again.')
  }
  if (res.status === 403)
    throw new SpotifyError(
      "Spotify refused. Its developer apps only work for accounts added under User Management in the Spotify dashboard, and the app owner needs Premium.",
    )
  if (res.status === 429) throw new SpotifyError('Spotify is busy. Wait a minute and try again.')
  if (!res.ok) throw new SpotifyError(`Spotify error (${res.status}).`)
  return (res.status === 204 ? undefined : await res.json()) as T
}

const clean = (s: string) => s.replace(/["]/g, '').replace(/\s*[([].*?(feat|ft|remaster|live|version).*?[)\]]/gi, '').trim()

/** Find the Spotify URI for a song. Returns null when there's no match. */
async function findUri(token: Token, t: Track): Promise<string | null> {
  if (t.source === 'spotify' && t.id.startsWith('spotify:track:')) return t.id
  const queries = [`track:"${clean(t.title)}" artist:"${clean(t.artist)}"`, `${clean(t.title)} ${clean(t.artist)}`]
  for (const q of queries) {
    const data = await api<{ tracks: { items: { uri: string }[] } }>(token, `/search?type=track&limit=1&q=${encodeURIComponent(q)}`)
    if (data.tracks.items[0]) return data.tracks.items[0].uri
  }
  return null
}

export type ExportResult = { url: string; added: number; missing: Track[] }

/** Sign in if needed, then create a private playlist with these songs. */
export async function saveToSpotify(name: string, description: string, tracks: Track[], onProgress?: (msg: string) => void): Promise<ExportResult> {
  onProgress?.('Signing in to Spotify…')
  const token = await signIn()

  onProgress?.('Finding your songs…')
  const uris: string[] = []
  const missing: Track[] = []
  for (const t of tracks) {
    const uri = await findUri(token, t)
    if (uri && !uris.includes(uri)) uris.push(uri)
    else if (!uri) missing.push(t)
  }
  if (!uris.length) throw new SpotifyError("Couldn't find any of these songs on Spotify.")

  onProgress?.('Creating the playlist…')
  const playlist = await api<{ id: string; external_urls: { spotify: string } }>(token, '/me/playlists', {
    method: 'POST',
    body: JSON.stringify({ name, description, public: false }),
  })
  for (let i = 0; i < uris.length; i += 100) {
    await api(token, `/playlists/${playlist.id}/items`, { method: 'POST', body: JSON.stringify({ uris: uris.slice(i, i + 100) }) })
  }
  return { url: playlist.external_urls.spotify, added: uris.length, missing }
}
