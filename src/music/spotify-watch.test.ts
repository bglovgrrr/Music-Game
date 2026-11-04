import { describe, expect, it } from 'vitest'
import { START_TIMEOUT_MS, type StartState, watchSpotify } from './spotify-watch'

const URI = 'spotify:track:ours'
const T = 1_000_000
const D = 200_000
const fresh = (): StartState => ({ at: T, confirmed: false, retried: false })
const pb = (uri: string | undefined = URI, progressMs = 10_000, isPlaying = true) => ({ isPlaying, progressMs, uri, durationMs: D })

describe('watching the host’s Spotify', () => {
  it('a song that never started is not finished', () => {
    expect(watchSpotify(pb('spotify:track:other', 50_000, false), URI, fresh(), T + 3000, D, 3000)).toBe('wait')
    expect(watchSpotify(null, URI, fresh(), T + 3000, D, 3000)).toBe('wait')
  })

  it('only confirms once Spotify’s progress is actually moving', () => {
    const s = fresh()
    expect(watchSpotify(pb(URI, 1000), URI, s, T + 2000, D, 2000)).toBe('wait') // first sighting
    expect(watchSpotify(pb(URI, 1000), URI, s, T + 4000, D, 4000)).toBe('wait') // stuck: not playing for real
    expect(watchSpotify(pb(URI, 3000), URI, s, T + 6000, D, 6000)).toBe('confirmed')
  })

  it('retries once, then gives up with an explanation', () => {
    expect(watchSpotify(null, URI, fresh(), T + START_TIMEOUT_MS, D, 7000)).toBe('retry')
    expect(watchSpotify(null, URI, { ...fresh(), retried: true }, T + START_TIMEOUT_MS, D, 7000)).toBe('give-up')
  })

  const ok = (): StartState => ({ ...fresh(), confirmed: true })

  it('Spotify going quiet mid-song is "lost", not "finished" (the jump-to-end bug)', () => {
    expect(watchSpotify(null, URI, ok(), T + 10_000, D, 10_000)).toBe('lost')
    expect(watchSpotify(pb('spotify:track:other', 5000, false), URI, ok(), T + 10_000, D, 10_000)).toBe('lost')
    expect(watchSpotify(pb('spotify:track:radio'), URI, ok(), T + 10_000, D, 10_000)).toBe('lost')
  })

  it('finishes near the end, including when Spotify autoplays something next', () => {
    expect(watchSpotify(pb(URI, 199_500), URI, ok(), T, D, 199_000)).toBe('ended')
    expect(watchSpotify(pb(URI, 199_000, false), URI, ok(), T, D, 199_000)).toBe('ended')
    expect(watchSpotify(pb('spotify:track:radio', 2000), URI, ok(), T, D, 198_000)).toBe('ended')
  })

  it('ignores an end-of-song position from Spotify when the game clock says the song just started (iPhone)', () => {
    expect(watchSpotify(pb(URI, 199_800), URI, ok(), T, D, 4000)).toBe('confirmed')
    expect(watchSpotify(pb(URI, 199_800, false), URI, ok(), T, D, 4000)).toBe('paused')
  })

  it('paused in the Spotify app mid-song means paused', () => {
    expect(watchSpotify(pb(URI, 60_000, false), URI, ok(), T, D, 60_000)).toBe('paused')
  })
})
