import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { currentPick, playbackPosition } from '@/game/engine'
import { useGame, useNow } from '@/hooks/use-game'

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
 * Plays the current song on the "speaker" device and keeps it in sync with the shared
 * playback state. Songs without audio (offline demo) are simulated with a timer.
 */
export function AudioEngine() {
  const { state, dispatch, client } = useGame()
  const audio = useRef<HTMLAudioElement | null>(null)
  const pick = currentPick(state)
  const src = pick?.track.previewUrl
  const { isPlaying } = state.playback
  const now = useNow(isPlaying && !src, 300)

  useEffect(() => {
    const el = getAudio()
    audio.current = el
    return () => el.pause()
  }, [])

  // Load the song
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

  // Follow play / pause / seek
  useEffect(() => {
    const el = audio.current
    if (!el || !src || !client.isSpeaker) return
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

  // Song finished
  useEffect(() => {
    const el = audio.current
    if (!el || !client.isSpeaker) return
    const onEnded = () => dispatch({ type: 'trackEnded' })
    el.addEventListener('ended', onEnded)
    return () => el.removeEventListener('ended', onEnded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  // Simulated playback end (no audio)
  useEffect(() => {
    if (!client.isSpeaker || src || !isPlaying || !pick) return
    if (playbackPosition(state, now) >= pick.track.durationMs) dispatch({ type: 'trackEnded' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now])

  return null
}
