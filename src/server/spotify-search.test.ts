import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handle, resetTokenCache, toTrack } from '../../api/spotify-search'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const item = {
  id: '1',
  uri: 'spotify:track:1',
  name: 'Landslide',
  duration_ms: 199_000,
  artists: [{ name: 'Fleetwood Mac' }],
  album: { name: 'Fleetwood Mac', uri: 'spotify:album:fm', images: [{ url: 'big', width: 640 }, { url: 'small', width: 64 }] },
  external_urls: { spotify: 'https://open.spotify.com/track/1' },
}

beforeEach(() => {
  resetTokenCache()
  vi.stubEnv('SPOTIFY_CLIENT_ID', 'id')
  vi.stubEnv('SPOTIFY_CLIENT_SECRET', 'secret')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('/api/spotify-search', () => {
  it('says it is not set up when the secret is missing', async () => {
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', '')
    const res = await handle(new Request('https://x/api/spotify-search?q=landslide'))
    expect(res.status).toBe(503)
  })

  it('rejects one-letter searches', async () => {
    expect((await handle(new Request('https://x/api/spotify-search?q=l'))).status).toBe(400)
  })

  it('gets an app token, searches in the visitor’s country, and returns app-shaped tracks with CDN caching', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(String(url))
        if (String(url).includes('/api/token')) {
          expect(init?.headers).toMatchObject({ Authorization: `Basic ${btoa('id:secret')}` })
          return json(200, { access_token: 'tok', expires_in: 3600 })
        }
        return json(200, { tracks: { items: [item] } })
      }),
    )
    const req = new Request('https://x/api/spotify-search?q=landslide', { headers: { 'x-vercel-ip-country': 'GB' } })
    const res = await handle(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('s-maxage=86400')
    expect((await res.json()).tracks).toEqual([toTrack(item)])
    expect(calls[1]).toContain('market=GB')
    expect(calls[1]).toContain('limit=10')

    // token is reused for the next search
    await handle(new Request('https://x/api/spotify-search?q=dreams'))
    expect(calls.filter((c) => c.includes('/api/token'))).toHaveLength(1)
  })

  it('maps tracks with the full length and a medium-size cover', () => {
    expect(toTrack(item)).toEqual({
      id: 'spotify:track:1',
      title: 'Landslide',
      artist: 'Fleetwood Mac',
      album: 'Fleetwood Mac',
      artwork: 'big',
      durationMs: 199_000,
      externalUrl: 'https://open.spotify.com/track/1',
      source: 'spotify',
      spotifyUri: 'spotify:track:1',
      spotifyAlbumUri: 'spotify:album:fm',
    })
  })

  it('reports Spotify errors as 502 without caching', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).includes('/api/token') ? json(200, { access_token: 't', expires_in: 3600 }) : json(429, {}))))
    const res = await handle(new Request('https://x/api/spotify-search?q=landslide'))
    expect(res.status).toBe(502)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})
