/** The app's single audio element, and unlocking it from a tap (phones block sound until then). */

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
let shared: HTMLAudioElement | null = null
let unlocked = false

/** One audio element for the whole app, so it stays "unlocked" once the user has tapped. */
export function getAudio() {
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
