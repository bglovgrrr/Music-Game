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
export const MIN_QUERY_LENGTH = 2

export type SearchResult = {
  tracks: Track[]
  offline: boolean
  /** Why live search wasn't used, in plain words (shown to the player). */
  reason?: string
}

/** For tests. */
export function resetSearchState() {
  itunesFailedAt = 0
  lastReason = ''
  cache.clear()
}

/**
 * Song search. Uses the free iTunes Search API (no key needed, 30s previews).
 * Falls back to a small built-in catalog when the network blocks it.
 */
export async function searchTracks(query: string, signal?: AbortSignal): Promise<SearchResult> {
  const q = query.trim()
  if (q.length < MIN_QUERY_LENGTH) return { tracks: [], offline: false }
  const key = q.toLowerCase()
  const cached = cache.get(key)
  if (cached) return { tracks: cached, offline: false }

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

export const spotifySearchUrl = (t: Track) =>
  `https://open.spotify.com/search/${encodeURIComponent(`${t.title} ${t.artist}`)}`
