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

export type SearchResult = { tracks: Track[]; offline: boolean }

/**
 * Song search. Uses the free iTunes Search API (no key needed, 30s previews).
 * Falls back to a small built-in catalog when the network blocks it.
 */
export async function searchTracks(query: string, signal?: AbortSignal): Promise<SearchResult> {
  const q = query.trim()
  if (!q) return { tracks: [], offline: false }

  if (Date.now() - itunesFailedAt >= RETRY_AFTER_MS) {
    try {
      const url = `https://itunes.apple.com/search?media=music&entity=song&limit=20&term=${encodeURIComponent(q)}`
      const timeout = AbortSignal.timeout(6000)
      const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { results: ItunesResult[] }
      itunesFailedAt = 0
      return { tracks: data.results.filter((r) => r.trackName).map(fromItunes), offline: false }
    } catch (err) {
      if (signal?.aborted) throw err
      // A blip (rate limit, flaky network) shouldn't switch search off for the whole game.
      itunesFailedAt = Date.now()
    }
  }
  return { tracks: searchDemoCatalog(q), offline: true }
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
