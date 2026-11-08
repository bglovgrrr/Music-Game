import type { Track } from '@/game/types'
import { searchDemoCatalog } from './demo-catalog'

type ItunesResult = {
  trackId: number
  trackName: string
  artistName: string
  collectionName?: string
  artworkUrl100?: string
  previewUrl?: string
  trackViewUrl?: string
}

const PREVIEW_MS = 30_000
/** After a failed iTunes request, use the built-in list briefly, then try iTunes again. */
export const RETRY_AFTER_MS = 20_000
let itunesFailedAt = 0
let lastReason = ''
/** Searches already done this session (fewer requests to Apple, instant repeats). */
const cache = new Map<string, Track[]>()
const MIN_QUERY_LENGTH = 2

export type SearchResult = {
  tracks: Track[]
  offline: boolean
  /** Why live search wasn't used, in plain words (shown to the player). */
  reason?: string
}

/** For tests. */
export function resetSearchState() {
  spotifySearch = 'unknown'
  itunesFailedAt = 0
  lastReason = ''
  cache.clear()
}

/** Spotify search via our Vercel function. Off for the session once we learn it isn't set up. */
let spotifySearch: 'unknown' | 'on' | 'off' = import.meta.env.MODE === 'preview' ? 'off' : 'unknown'

async function searchSpotify(q: string, signal?: AbortSignal): Promise<Track[] | null> {
  if (spotifySearch === 'off') return null
  try {
    const res = await fetchWithTimeout(`/api/spotify-search?q=${encodeURIComponent(q)}`, 8000, signal)
    const type = res.headers.get('content-type') ?? ''
    if (res.status === 503 || !type.includes('application/json')) {
      spotifySearch = 'off' // not configured, or a local dev server without the function
      return null
    }
    if (!res.ok) return null
    const data = (await res.json()) as { tracks: Track[] }
    spotifySearch = 'on'
    return data.tracks
  } catch (err) {
    if (signal?.aborted) throw err
    return null
  }
}

/**
 * Song search: Spotify's full catalogue first (via /api/spotify-search), then the free
 * iTunes Search API (30s previews), then a small built-in list if both are unreachable.
 */
export async function searchTracks(query: string, signal?: AbortSignal): Promise<SearchResult> {
  const q = query.trim()
  if (q.length < MIN_QUERY_LENGTH) return { tracks: [], offline: false }
  const key = q.toLowerCase()
  const cached = cache.get(key)
  if (cached) return { tracks: cached, offline: false }

  const fromSpotify = await searchSpotify(q, signal)
  if (fromSpotify) {
    cache.set(key, fromSpotify)
    return { tracks: fromSpotify, offline: false }
  }

  if (Date.now() - itunesFailedAt >= RETRY_AFTER_MS) {
    try {
      const url = `https://itunes.apple.com/search?media=music&entity=song&limit=20&term=${encodeURIComponent(q)}`
      const res = await fetchWithTimeout(url, 6000, signal)
      if (!res.ok) {
        lastReason =
          res.status === 403 || res.status === 429
            ? `Apple Music search is busy right now (${res.status}). Trying again shortly.`
            : `Apple Music search had a problem (${res.status}).`
        throw new Error(lastReason)
      }
      const data = (await res.json()) as { results: ItunesResult[] }
      itunesFailedAt = 0
      lastReason = ''
      const tracks = data.results.filter((r) => r.trackName).map(fromItunes)
      if (cache.size > 200) cache.clear()
      cache.set(key, tracks)
      return { tracks, offline: false }
    } catch (err) {
      if (signal?.aborted) throw err
      if (!lastReason || !(err instanceof Error && err.message === lastReason)) {
        lastReason = navigator.onLine === false ? "You're offline." : `Couldn't reach Apple Music search (${(err as Error)?.name || 'error'}).`
      }
      // A blip (rate limit, flaky network) shouldn't switch search off for the whole game.
      itunesFailedAt = Date.now()
    }
  }
  return { tracks: searchDemoCatalog(q), offline: true, reason: lastReason || undefined }
}

/**
 * fetch() with a timeout that also stops when `signal` aborts.
 * Written by hand because AbortSignal.any / AbortSignal.timeout are missing on
 * older iPhones (before iOS 17.4), where they made every search fail.
 */
async function fetchWithTimeout(url: string, ms: number, signal?: AbortSignal) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  const onAbort = () => ctrl.abort()
  if (signal?.aborted) ctrl.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

function fromItunes(r: ItunesResult): Track {
  return {
    id: `itunes_${r.trackId}`,
    title: r.trackName,
    artist: r.artistName,
    album: r.collectionName,
    artwork: r.artworkUrl100?.replace('100x100bb', '600x600bb'),
    previewUrl: r.previewUrl,
    durationMs: PREVIEW_MS,
    externalUrl: r.trackViewUrl,
    source: 'itunes',
  }
}

/** Find a 30-second preview for a song (e.g. a Spotify pick when the host isn't connected). */
export async function findPreview(t: Track): Promise<string | null> {
  if (t.previewUrl) return t.previewUrl
  try {
    const res = await fetchWithTimeout(
      `https://itunes.apple.com/search?media=music&entity=song&limit=1&term=${encodeURIComponent(`${t.title} ${t.artist.split(',')[0]}`)}`,
      6000,
    )
    if (!res.ok) return null
    const data = (await res.json()) as { results: ItunesResult[] }
    return data.results[0]?.previewUrl ?? null
  } catch {
    return null
  }
}

export const spotifySearchUrl = (t: Track) =>
  `https://open.spotify.com/search/${encodeURIComponent(`${t.title} ${t.artist}`)}`
