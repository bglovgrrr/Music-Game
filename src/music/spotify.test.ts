import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '@/game/types'

const store = new Map<string, string>()
;(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
}

const { saveToSpotify } = await import('./spotify')

const track = (title: string, artist: string): Track => ({ id: title, title, artist, durationMs: 30_000, source: 'itunes' })
type Call = { url: string; method: string; body?: unknown }

function fakeSpotify(opts: { createStatus?: number; known?: string[] } = {}) {
  const calls: Call[] = []
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url)
    calls.push({ url: u.pathname + u.search, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
    if (u.pathname === '/v1/search') {
      const q = u.searchParams.get('q') ?? ''
      const hit = (opts.known ?? []).find((t) => q.includes(t))
      return json(200, { tracks: { items: hit ? [{ uri: `spotify:track:${hit}` }] : [] } })
    }
    if (u.pathname === '/v1/me/playlists') {
      if (opts.createStatus && opts.createStatus !== 201) return json(opts.createStatus, { error: { status: opts.createStatus } })
      return json(201, { id: 'pl1', external_urls: { spotify: 'https://open.spotify.com/playlist/pl1' } })
    }
    if (u.pathname === '/v1/playlists/pl1/items') return json(201, { snapshot_id: 's' })
    return json(404, {})
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

beforeEach(() => {
  store.clear()
  // Already signed in (the sign-in window itself needs a real browser).
  store.set('mm:spotify-token', JSON.stringify({ access_token: 'tok', expires_at: Date.now() + 3_600_000 }))
})

describe('Save to Spotify', () => {
  it('finds each song, creates a private playlist, and adds the songs', async () => {
    const calls = fakeSpotify({ known: ['Landslide', 'Fast Car'] })
    const res = await saveToSpotify('Side B · Nov 3', 'desc', [track('Landslide', 'Fleetwood Mac'), track('Fast Car', 'Tracy Chapman'), track('Unknown Song', 'Nobody')])
    expect(res).toEqual({ url: 'https://open.spotify.com/playlist/pl1', added: 2, missing: [track('Unknown Song', 'Nobody')] })
    const create = calls.find((c) => c.url === '/v1/me/playlists')!
    expect(create).toMatchObject({ method: 'POST', body: { name: 'Side B · Nov 3', public: false } })
    const add = calls.find((c) => c.url === '/v1/playlists/pl1/items')!
    expect(add).toMatchObject({ method: 'POST', body: { uris: ['spotify:track:Landslide', 'spotify:track:Fast Car'] } })
  })

  it('skips duplicate songs', async () => {
    const calls = fakeSpotify({ known: ['Landslide'] })
    const res = await saveToSpotify('x', 'y', [track('Landslide', 'Fleetwood Mac'), track('Landslide', 'Fleetwood Mac')])
    expect(res.added).toBe(1)
    expect(calls.find((c) => c.url.endsWith('/items'))!.body).toEqual({ uris: ['spotify:track:Landslide'] })
  })

  it('adds songs in batches of 100', async () => {
    const titles = Array.from({ length: 150 }, (_, i) => `Song${String(i).padStart(3, '0')}`)
    const calls = fakeSpotify({ known: titles })
    await saveToSpotify('x', 'y', titles.map((t) => track(t, 'A')))
    const adds = calls.filter((c) => c.url.endsWith('/items'))
    expect(adds.map((c) => (c.body as { uris: string[] }).uris.length)).toEqual([100, 50])
  })

  it('explains a 403 (Spotify developer-app limits) instead of failing silently', async () => {
    fakeSpotify({ known: ['Landslide'], createStatus: 403 })
    await expect(saveToSpotify('x', 'y', [track('Landslide', 'Fleetwood Mac')])).rejects.toThrow(/User Management/)
  })

  it('fails clearly when nothing can be found', async () => {
    fakeSpotify({ known: [] })
    await expect(saveToSpotify('x', 'y', [track('Nope', 'Nobody')])).rejects.toThrow(/Couldn't find/)
  })
})
