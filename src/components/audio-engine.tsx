import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { currentPick, playbackPosition } from '@/game/engine'
import type { Track } from '@/game/types'
import { useGame, useNow } from '@/hooks/use-game'
import { useSpotifyConnected } from '@/hooks/use-spotify'
import { SpotifyError } from '@/music/spotify-auth'
import { getPlayback, pausePlayback, playTrack, seekTo } from '@/music/spotify-player'
import { findPreview } from '@/music/search'

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
  const startedHere = useRef(false)
  const now = useNow(isPlaying, 2500)

  const fail = (err: unknown) => {
    const msg = err instanceof SpotifyError ? err.message : 'Couldn’t control Spotify.'
    toast.error(msg)
    sent.current = null
    dispatch({ type: 'pause' })
  }

  // Follow play / pause / seek.
  useEffect(() => {
    const prev = sent.current
    const pos = playbackPosition(state)
    if (isPlaying) {
      if (!prev || prev.uri !== uri || !prev.playing) {
        sent.current = { uri, playing: true, at: updatedAt }
        startedHere.current = true
        playTrack(uri, pos).catch(fail)
      } else if (prev.at !== updatedAt) {
        sent.current = { ...prev, at: updatedAt }
        seekTo(pos).catch(fail)
      }
    } else if (prev?.playing) {
      sent.current = { uri, playing: false, at: updatedAt }
      pausePlayback().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, isPlaying, positionMs, updatedAt])

  // Watch Spotify: song finished, or Spotify moved on / was paused in its own app.
  useEffect(() => {
    if (!isPlaying || !sent.current?.playing) return
    if (Date.now() - updatedAt < 3000) return // give Spotify a moment to start
    getPlayback()
      .then((pb) => {
        if (!pb) return
        const nearEnd = (pb.durationMs ?? track.durationMs) - pb.progressMs < 3000
        if (pb.uri !== uri || (!pb.isPlaying && nearEnd) || nearEnd) {
          if (pb.uri !== uri && pb.isPlaying) void pausePlayback().catch(() => {}) // stop autoplay
          sent.current = { uri, playing: false, at: updatedAt }
          dispatch({ type: 'trackEnded' })
        } else if (!pb.isPlaying) {
          sent.current = { uri, playing: false, at: updatedAt }
          dispatch({ type: 'pause' })
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
