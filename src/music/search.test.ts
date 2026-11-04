import { afterEach, describe, expect, it, vi } from 'vitest'
import { beforeEach } from 'vitest'
import { RETRY_AFTER_MS, resetSearchState, searchTracks } from './search'

beforeEach(() => resetSearchState())

const ok = () =>
  new Response(JSON.stringify({ results: [{ trackId: 1, trackName: 'Landslide', artistName: 'Fleetwood Mac', previewUrl: 'https://x/p.m4a' }] }), { status: 200 })
const jsonRes = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const spotifyNotSetUp = () => jsonRes(503, { error: 'not_configured' })
/** Route fetches: /api/spotify-search -> spotify(), everything else (iTunes) -> itunes(). */
const route = (itunes: () => Response | Promise<Response>, spotify: () => Response = spotifyNotSetUp) =>
  vi.fn(async (url: string) => (String(url).startsWith('/api/spotify-search') ? spotify() : itunes()))
const itunesCalls = (m: ReturnType<typeof vi.fn>) => m.mock.calls.filter(([u]) => !String(u).startsWith('/api/')).length

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('song search', () => {
  it('uses Spotify search first when it is set up', async () => {
    const spotifyTrack = { id: 'spotify:track:1', title: 'Landslide', artist: 'Fleetwood Mac', durationMs: 199_000, source: 'spotify', spotifyUri: 'spotify:track:1' }
    const fetchMock = route(ok, () => jsonRes(200, { tracks: [spotifyTrack] }))
    vi.stubGlobal('fetch', fetchMock)
    const r = await searchTracks('landslide')
    expect(r).toMatchObject({ offline: false, tracks: [spotifyTrack] })
    expect(itunesCalls(fetchMock)).toBe(0)
  })

  it('falls back to iTunes when Spotify search is not set up, and stops asking Spotify', async () => {
    const fetchMock = route(ok)
    vi.stubGlobal('fetch', fetchMock)
    expect((await searchTracks('landslide')).tracks[0].source).toBe('itunes')
    await searchTracks('dreams')
    expect(fetchMock.mock.calls.filter(([u]) => String(u).startsWith('/api/')).length).toBe(1)
  })

  it('uses iTunes when it works', async () => {
    vi.stubGlobal('fetch', route(ok))
    const r = await searchTracks('landslide')
    expect(r.offline).toBe(false)
    expect(r.tracks[0]).toMatchObject({ title: 'Landslide', artist: 'Fleetwood Mac', source: 'itunes' })
  })

  it('works on older iPhones without AbortSignal.any / AbortSignal.timeout', async () => {
    const any = AbortSignal.any
    const timeout = AbortSignal.timeout
    // @ts-expect-error simulate an older browser
    delete AbortSignal.any
    // @ts-expect-error simulate an older browser
    delete AbortSignal.timeout
    try {
      vi.stubGlobal('fetch', route(ok))
      const r = await searchTracks('landslide', new AbortController().signal)
      expect(r.offline).toBe(false)
      expect(r.tracks[0].title).toBe('Landslide')
    } finally {
      AbortSignal.any = any
      AbortSignal.timeout = timeout
    }
  })

  it('stops a search when the user keeps typing (abort)', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_res, rej) => init.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))))
    const ctrl = new AbortController()
    const pending = searchTracks('land', ctrl.signal)
    ctrl.abort()
    await expect(pending).rejects.toThrow(/abort/i)
  })

  it('falls back to the built-in list after a failure, then tries iTunes again', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_000_000)
    let itunes = async () => new Response('', { status: 403 })
    const fetchMock = route(() => itunes())
    vi.stubGlobal('fetch', fetchMock)

    const first = await searchTracks('landslide')
    expect(first.offline).toBe(true)
    expect(first.reason).toMatch(/busy right now \(403\)/)
    expect(first.tracks.some((t) => t.title === 'Landslide')).toBe(true) // from the built-in list

    // Right after a failure: don't hammer iTunes
    await searchTracks('dreams')
    expect(itunesCalls(fetchMock)).toBe(1)

    // After the pause, iTunes is tried again and works
    vi.setSystemTime(1_000_000 + RETRY_AFTER_MS)
    itunes = async () => ok()
    const later = await searchTracks('landslide fleetwood')
    expect(later.offline).toBe(false)
    expect(itunesCalls(fetchMock)).toBe(2)
  })
  it('remembers results and skips one-letter searches (fewer requests to Apple)', async () => {
    const fetchMock = route(ok)
    vi.stubGlobal('fetch', fetchMock)
    expect((await searchTracks('l')).tracks).toEqual([])
    await searchTracks('Landslide')
    await searchTracks('landslide ')
    expect(itunesCalls(fetchMock)).toBe(1)
  })
})
