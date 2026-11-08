/**
 * "Save to Spotify": finds each song on Spotify and creates a private playlist in the
 * signed-in user's account (sign-in lives in spotify-auth.ts).
 *
 * Uses the endpoints from Spotify's February 2026 Web API changes:
 * POST /v1/me/playlists and POST /v1/playlists/{id}/items.
 */
import type { Track } from '@/game/types'
import { connectSpotify, SpotifyError, spotifyApi, spotifyConfigured } from './spotify-auth'

export const spotifyAvailable = spotifyConfigured

type Token = Record<string, never>
const api = <T>(_token: Token, path: string, init?: RequestInit) => spotifyApi<T>(path, init)

const clean = (s: string) =>
  s
    .replace(/["]/g, '')
    .replace(/\s*[([].*?(feat|ft|remaster|live|version).*?[)\]]/gi, '')
    .trim()

/** Find the Spotify URI for a song. Returns null when there's no match. */
async function findUri(token: Token, t: Track): Promise<string | null> {
  if (t.spotifyUri) return t.spotifyUri
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
  await connectSpotify()
  const token: Token = {}

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
