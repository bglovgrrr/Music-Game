import type { SpotifyPlayback } from './spotify-player'

export const START_TIMEOUT_MS = 7000

export type StartState = { at: number; confirmed: boolean; retried: boolean }

export type WatchAction =
  | 'wait' // keep waiting for Spotify to start
  | 'confirmed' // Spotify is playing our song
  | 'retry' // didn't start in time: ask once more
  | 'give-up' // still didn't start: explain to the host
  | 'ended' // our song finished, or Spotify moved on to another song
  | 'paused' // paused from inside the Spotify app

/**
 * What to do after asking Spotify what's playing. Key rule: a song that never
 * started is *not* finished (that bug skipped songs when the phone's Spotify was asleep).
 */
export function watchSpotify(pb: SpotifyPlayback | null, uri: string, s: StartState, now: number, fallbackDurationMs: number): WatchAction {
  const ours = !!pb && pb.uri === uri
  if (ours && pb.isPlaying) {
    const nearEnd = (pb.durationMs ?? fallbackDurationMs) - pb.progressMs < 1000
    return s.confirmed && nearEnd ? 'ended' : 'confirmed'
  }
  if (!s.confirmed) {
    if (now - s.at < START_TIMEOUT_MS) return 'wait'
    return s.retried ? 'give-up' : 'retry'
  }
  if (!ours) return 'ended'
  const nearEnd = (pb.durationMs ?? fallbackDurationMs) - pb.progressMs < 2500
  return nearEnd ? 'ended' : 'paused'
}
