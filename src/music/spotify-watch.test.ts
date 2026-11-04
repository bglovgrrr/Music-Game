import { describe, expect, it } from 'vitest'
import { START_TIMEOUT_MS, watchSpotify } from './spotify-watch'

const URI = 'spotify:track:ours'
const T = 1_000_000
const fresh = { at: T, confirmed: false, retried: false }
const playing = (uri = URI, progressMs = 10_000, isPlaying = true) => ({ isPlaying, progressMs, uri, durationMs: 200_000 })

describe('watching the host’s Spotify', () => {
  it('a song that never started is NOT treated as finished (the skip bug)', () => {
    // Spotify reports some other song, or nothing, right after we asked it to play
    expect(watchSpotify(playing('spotify:track:other', 50_000, false), URI, fresh, T + 3000, 200_000)).toBe('wait')
    expect(watchSpotify(null, URI, fresh, T + 3000, 200_000)).toBe('wait')
  })

  it('retries once, then gives up with an explanation', () => {
    expect(watchSpotify(null, URI, fresh, T + START_TIMEOUT_MS, 200_000)).toBe('retry')
    expect(watchSpotify(null, URI, { ...fresh, retried: true }, T + START_TIMEOUT_MS, 200_000)).toBe('give-up')
  })

  it('confirms when Spotify plays our song', () => {
    expect(watchSpotify(playing(), URI, fresh, T + 2000, 200_000)).toBe('confirmed')
  })

  const confirmed = { ...fresh, confirmed: true }

  it('after confirming: another song means ours ended (or autoplay moved on)', () => {
    expect(watchSpotify(playing('spotify:track:radio'), URI, confirmed, T + 60_000, 200_000)).toBe('ended')
    expect(watchSpotify(null, URI, confirmed, T + 60_000, 200_000)).toBe('ended')
  })

  it('after confirming: reaching the end means ended; paused mid-song means paused', () => {
    expect(watchSpotify(playing(URI, 199_500), URI, confirmed, T, 200_000)).toBe('ended')
    expect(watchSpotify(playing(URI, 199_000, false), URI, confirmed, T, 200_000)).toBe('ended')
    expect(watchSpotify(playing(URI, 60_000, false), URI, confirmed, T, 200_000)).toBe('paused')
  })
})
