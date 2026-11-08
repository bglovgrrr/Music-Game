import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { currentPick, playbackPosition } from '@/game/engine'
import type { Track } from '@/game/types'
import { useGame, useNow } from '@/hooks/use-game'
import { useSpotifyConnected } from '@/hooks/use-spotify'
import { SpotifyError } from '@/music/spotify-auth'
import { getPlayback, pausePlayback, playTrack, seekTo, isIOS, setPhoneSpotify, wakeSpotify, justWoke, clearWoke } from '@/music/spotify-player'
import { findPreview } from '@/music/search'
import { logSpotify } from '@/music/spotify-log'
import { watchSpotify } from '@/music/spotify-watch'

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
let shared: HTMLAudioElement | null = null
let unlocked = false

/** One audio element for the whole app, so it stays "unlocked" once the user has tapped. */
function getAudio() {
  if (!shared) {
    shared = new Audio()
    shared.preload = 'auto'
  }
  return shared
}

/**
 * Phones only let a page play sound after a tap. Call this from any tap so that later,
 * when someone else presses play on their phone, the speaker device is allowed to start.
 */
export function unlockAudio() {
  if (unlocked) return
  unlocked = true
  const el = getAudio()
  if (el.getAttribute('src')) return
  el.src = SILENT_WAV
  el.play()
    .then(() => el.pause())
    .catch(() => {
      unlocked = false
    })
}

/**
 * Plays the current song on the speaker device (the host) and keeps it in step with the
 * shared play/pause/seek state:
 * - Spotify songs + host connected to Spotify: the full song on the host's Spotify.
 * - Otherwise: a 30-second preview in the browser (looked up if the song has none).
 */
export function AudioEngine() {
  const { state } = useGame()
  const pick = currentPick(state)
  const connected = useSpotifyConnected()
  if (!pick) return null
  return pick.track.spotifyUri && connected ? <SpotifyEngine track={pick.track} /> : <PreviewEngine track={pick.track} />
}

/** 30-second previews in the browser. */
function PreviewEngine({ track }: { track: Track }) {
  const { state, dispatch } = useGame()
  const audio = useRef<HTMLAudioElement | null>(null)
  const [found, setFound] = useState<{ id: string; url: string | null } | null>(null)
  const src = track.previewUrl ?? (found?.id === track.id ? (found.url ?? undefined) : undefined)
  const { isPlaying } = state.playback
  const now = useNow(isPlaying && !src, 300)

  // Songs without a preview (e.g. from Spotify search): look one up.
  useEffect(() => {
    if (track.previewUrl || found?.id === track.id) return
    let cancelled = false
    void findPreview(track).then((url) => !cancelled && setFound({ id: track.id, url }))
    return () => {
      cancelled = true
    }
  }, [track, found?.id])

  useEffect(() => {
    const el = getAudio()
    audio.current = el
    return () => el.pause()
  }, [])

  useEffect(() => {
    const el = audio.current
    if (!el) return
    if (src) {
      if (el.src !== src) el.src = src
    } else {
      el.pause()
      el.removeAttribute('src')
    }
  }, [src])

  useEffect(() => {
    const el = audio.current
    if (!el || !src) return
    const target = playbackPosition(state) / 1000
    if (Math.abs(el.currentTime - target) > 1) el.currentTime = target
    if (isPlaying) {
      el.play().catch(() => {
        toast('Tap play to start the music', { description: 'Your browser blocked autoplay.' })
        dispatch({ type: 'pause' })
      })
    } else el.pause()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, isPlaying, state.playback.positionMs, state.playback.updatedAt])

  useEffect(() => {
    const el = audio.current
    if (!el) return
    const onEnded = () => dispatch({ type: 'trackEnded' })
    el.addEventListener('ended', onEnded)
    return () => el.removeEventListener('ended', onEnded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // No audio at all (offline list): simulate the clock.
  useEffect(() => {
    if (src || !isPlaying) return
    if (playbackPosition(state, now) >= track.durationMs) dispatch({ type: 'trackEnded' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now])

  return null
}

/** Full songs on the host's Spotify, following the shared state. */
function SpotifyEngine({ track }: { track: Track }) {
  const { state, dispatch } = useGame()
  const uri = track.spotifyUri!
  const { isPlaying, positionMs, updatedAt } = state.playback
  const sent = useRef<{ uri: string; playing: boolean; at: number } | null>(null)
  // Has Spotify confirmed it is playing *this* song since we asked it to?
  const start = useRef<{ at: number; confirmed: boolean; retried: boolean; device: string; lastProgress?: number }>({
    at: 0,
    confirmed: false,
    retried: false,
    device: '',
  })
  const startedHere = useRef(false)
  const now = useNow(isPlaying, 2000)

  const fail = (err: unknown) => {
    const noDevice = err instanceof SpotifyError && err.code === 'no_device'
    const msg = err instanceof SpotifyError ? err.message : 'Couldn’t control Spotify.'
    logSpotify(`error: ${msg}`)
    if (noDevice && isIOS()) {
      setPhoneSpotify('asleep')
      toast.error('Spotify isn’t open on this phone', {
        description: 'Tap Open Spotify, then come straight back. The song starts by itself.',
        duration: 15_000,
        action: { label: 'Open Spotify', onClick: wakeSpotify },
      })
    } else toast.error(msg, { duration: 10_000 })
    sent.current = null
    dispatch({ type: 'pause' })
    // It never started: put the tape back to the beginning (not "played and stopped").
    if (!start.current.confirmed) dispatch({ type: 'seek', positionMs: 0 })
  }

  // Back from opening Spotify: start the song by itself.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !justWoke()) return
      window.setTimeout(() => {
        if (!justWoke()) return
        clearWoke()
        dispatch({ type: 'play' })
      }, 2500)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [dispatch])

  const startSong = (pos: number) => {
    start.current = { ...start.current, at: Date.now(), confirmed: false, lastProgress: undefined }
    startedHere.current = true
    logSpotify(`play “${track.title}” from ${Math.round(pos / 1000)}s`)
    playTrack(uri, pos, track.spotifyAlbumUri)
      .then((d) => {
        start.current.device = d.name
        logSpotify(`  accepted by ${d.name}`)
      })
      .catch(fail)
  }

  // Follow play / pause / seek.
  useEffect(() => {
    const prev = sent.current
    const pos = playbackPosition(state)
    if (isPlaying) {
      if (!prev || prev.uri !== uri || !prev.playing) {
        sent.current = { uri, playing: true, at: updatedAt }
        if (!prev || prev.uri !== uri) start.current.retried = false
        startSong(pos)
      } else if (prev.at !== updatedAt) {
        sent.current = { ...prev, at: updatedAt }
        logSpotify(`seek to ${Math.round(pos / 1000)}s`)
        seekTo(pos).catch(fail)
      }
    } else if (prev?.playing) {
      sent.current = { uri, playing: false, at: updatedAt }
      logSpotify('pause')
      pausePlayback().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, isPlaying, positionMs, updatedAt])

  // Watch Spotify while we think it's playing.
  useEffect(() => {
    if (!isPlaying || !sent.current?.playing) return
    const s = start.current
    if (Date.now() - s.at < 1500) return
    getPlayback()
      .then((pb) => {
        if (!sent.current?.playing) return
        const gamePos = playbackPosition(state)
        const action = watchSpotify(pb, uri, s, Date.now(), track.durationMs, gamePos)
        logSpotify(
          `check: spotify ${pb ? `${pb.isPlaying ? 'playing' : 'paused'} ${pb.uri === uri ? 'this song' : 'other/none'} at ${Math.round(pb.progressMs / 1000)}s/${Math.round((pb.durationMs ?? 0) / 1000)}s` : 'nothing'} · game at ${Math.round(gamePos / 1000)}s → ${action}`,
        )
        if (action === 'confirmed') s.confirmed = true
        else if (action === 'retry') {
          s.retried = true
          startSong(playbackPosition(state))
        } else if (action === 'give-up') {
          const where = s.device ? `“${s.device}”` : 'the selected device'
          fail(
            new SpotifyError(
              `Spotify didn’t start playing on ${where}. On iPhone, open the Spotify app and start any song first (iOS can’t wake Spotify up from the background), or pick another device under “Play on”.`,
            ),
          )
        } else if (action === 'ended') {
          if (pb && pb.uri !== uri && pb.isPlaying) void pausePlayback().catch(() => {}) // stop autoplay
          sent.current = { uri, playing: false, at: updatedAt }
          dispatch({ type: 'trackEnded' })
        } else if (action === 'paused') {
          sent.current = { uri, playing: false, at: updatedAt }
          dispatch({ type: 'pause' })
        } else if (action === 'lost') {
          sent.current = { uri, playing: false, at: updatedAt }
          dispatch({ type: 'pause' })
          toast.error(`Spotify stopped playing${s.device ? ` on “${s.device}”` : ''}. Tap play to try again, or use “Test Spotify” on the Spotify card.`, {
            duration: 10_000,
          })
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now])

  // Leaving the listening screen: stop the music we started.
  useEffect(
    () => () => {
      if (startedHere.current && sent.current?.playing) void pausePlayback().catch(() => {})
    },
    [],
  )

  // Make sure a preview isn't also playing.
  useEffect(() => {
    getAudio().pause()
  }, [])

  return null
}
