import { afterEach, describe, expect, it, vi } from 'vitest'
import { RETRY_AFTER_MS, searchTracks } from './search'

const ok = () =>
  new Response(JSON.stringify({ results: [{ trackId: 1, trackName: 'Landslide', artistName: 'Fleetwood Mac', previewUrl: 'https://x/p.m4a' }] }), { status: 200 })

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('song search', () => {
  it('uses iTunes when it works', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok()))
    const r = await searchTracks('landslide')
    expect(r.offline).toBe(false)
    expect(r.tracks[0]).toMatchObject({ title: 'Landslide', artist: 'Fleetwood Mac', source: 'itunes' })
  })

  it('falls back to the built-in list after a failure, then tries iTunes again', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_000_000)
    const fetchMock = vi.fn(async () => new Response('', { status: 403 }))
    vi.stubGlobal('fetch', fetchMock)

    const first = await searchTracks('landslide')
    expect(first.offline).toBe(true)
    expect(first.tracks.some((t) => t.title === 'Landslide')).toBe(true) // from the built-in list

    // Right after a failure: don't hammer iTunes
    await searchTracks('dreams')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // After the pause, iTunes is tried again and works
    vi.setSystemTime(1_000_000 + RETRY_AFTER_MS)
    fetchMock.mockImplementation(async () => ok())
    const later = await searchTracks('landslide')
    expect(later.offline).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
