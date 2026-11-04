import type { SpotifyPlayback } from './spotify-player'

export const START_TIMEOUT_MS = 7000

export type StartState = {
  at: number
  confirmed: boolean
  retried: boolean
  /** Progress Spotify reported last time we saw our song (to check it's really moving). */
  lastProgress?: number
}

export type WatchAction =
  | 'wait' // keep waiting for Spotify to start
  | 'confirmed' // Spotify is really playing our song (progress moving)
  | 'retry' // didn't start in time: ask once more
  | 'give-up' // still didn't start: explain to the host
  | 'ended' // our song finished, or Spotify moved on after it finished
  | 'paused' // paused in the Spotify app
  | 'lost' // Spotify stopped mid-song (device went away / nothing playing)

/**
 * What to do after asking Spotify what's playing.
 * - A song only counts as started once Spotify reports it with progress moving.
 * - A song only counts as finished near its end. Spotify going quiet mid-song is "lost",
 *   not "finished" (that bug jumped the timeline to the end).
 *
 * `sharedPosMs` is where the game thinks the song is.
 */
export function watchSpotify(
  pb: SpotifyPlayback | null,
  uri: string,
  s: StartState,
  now: number,
  durationMs: number,
  sharedPosMs: number,
): WatchAction {
  const ours = !!pb && pb.uri === uri
  const duration = (ours && pb.durationMs) || durationMs
  // Only believe "finished" if the game's own clock agrees the song is nearly over.
  // (Spotify on iPhone has reported end-of-song positions seconds after starting.)
  const gameNearEnd = durationMs - sharedPosMs < 15_000

  if (ours && pb.isPlaying) {
    if (s.confirmed) return duration - pb.progressMs < 1000 && gameNearEnd ? 'ended' : 'confirmed'
    const moving = s.lastProgress !== undefined && pb.progressMs > s.lastProgress
    s.lastProgress = pb.progressMs
    if (moving) return 'confirmed'
  }

  if (!s.confirmed) {
    if (now - s.at < START_TIMEOUT_MS) return 'wait'
    return s.retried ? 'give-up' : 'retry'
  }

  if (ours) return duration - pb.progressMs < 2500 && gameNearEnd ? 'ended' : 'paused'
  // Our song is gone. If the game clock says it was basically over, Spotify moved on after it ended.
  if (pb?.isPlaying && durationMs - sharedPosMs < 5000) return 'ended'
  return 'lost'
}
