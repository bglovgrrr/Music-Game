/** Recent Spotify playback events on this device, for the host to copy when something goes wrong. */
const lines: string[] = []
const listeners = new Set<() => void>()

export function logSpotify(msg: string) {
  const t = new Date()
  const stamp = `${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`
  lines.push(`${stamp} ${msg}`)
  if (lines.length > 60) lines.shift()
  listeners.forEach((l) => l())
}

export const spotifyLogLines = () => lines.slice()

export function onSpotifyLog(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
