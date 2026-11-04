/**
 * GET /api/spotify-search?q=landslide
 *
 * Searches Spotify's catalogue for everyone in the game, no Spotify account needed.
 * Runs on Vercel so the app secret never reaches the browser (Client Credentials flow).
 * Needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in the Vercel project's
 * environment variables. Results are cached on Vercel's CDN for a day.
 */

type SpotifyTrack = {
  id: string
  uri: string
  name: string
  duration_ms: number
  artists: { name: string }[]
  album?: { name?: string; uri?: string; images?: { url: string; width?: number | null }[] }
  external_urls?: { spotify?: string }
}

/** Same shape as the app's Track type (src/game/types.ts). */
export type SearchTrack = {
  id: string
  title: string
  artist: string
  album?: string
  artwork?: string
  durationMs: number
  externalUrl?: string
  source: 'spotify'
  spotifyUri: string
  spotifyAlbumUri?: string
}

let cached: { token: string; expiresAt: number } | null = null

/** For tests. */
export function resetTokenCache() {
  cached = null
}

async function appToken(clientId: string, secret: string): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`token ${res.status}`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return cached.token
}

export function toTrack(t: SpotifyTrack): SearchTrack {
  const images = [...(t.album?.images ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))
  return {
    id: t.uri,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(', '),
    album: t.album?.name,
    artwork: images.find((i) => (i.width ?? 0) <= 640)?.url ?? images[0]?.url,
    durationMs: t.duration_ms,
    externalUrl: t.external_urls?.spotify,
    source: 'spotify',
    spotifyUri: t.uri,
    spotifyAlbumUri: t.album?.uri,
  }
}

const json = (status: number, body: unknown, cache = 'no-store') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache } })

export async function handle(request: Request): Promise<Response> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const secret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !secret) return json(503, { error: 'not_configured' })

  const url = new URL(request.url)
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100)
  if (q.length < 2) return json(400, { error: 'query_too_short' })
  const market = /^[A-Z]{2}$/.test(request.headers.get('x-vercel-ip-country') ?? '') ? request.headers.get('x-vercel-ip-country')! : 'US'

  try {
    const token = await appToken(clientId, secret)
    const search = `https://api.spotify.com/v1/search?type=track&limit=10&market=${market}&q=${encodeURIComponent(q)}`
    const res = await fetch(search, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401) cached = null
    if (!res.ok) return json(502, { error: 'spotify_error', status: res.status })
    const data = (await res.json()) as { tracks?: { items?: SpotifyTrack[] } }
    const tracks = (data.tracks?.items ?? []).filter(Boolean).map(toTrack)
    // Cache on Vercel's CDN: repeat searches are instant and don't use Spotify's quota.
    return json(200, { tracks }, 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800')
  } catch (err) {
    return json(502, { error: 'spotify_unreachable', detail: String((err as Error)?.message ?? err) })
  }
}

export default { fetch: handle }
