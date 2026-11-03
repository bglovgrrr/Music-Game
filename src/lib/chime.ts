/**
 * Gentle cues: a soft two-note chime (Web Audio, no files) plus a short buzz on
 * phones that allow it. iPhones don't let websites vibrate, so they get sound only.
 */
let ctx: AudioContext | null = null

/** Call from a tap: browsers only allow sound after the user has interacted. */
export function unlockChime() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* no Web Audio */
  }
}

const NOTES = {
  /** Your turn to ask */
  turn: [659.25, 880],
  /** Picking has started */
  pick: [523.25, 659.25],
  /** 10 seconds left */
  hurry: [880, 880],
} as const

export type Cue = keyof typeof NOTES

export function chime(cue: Cue) {
  try {
    navigator.vibrate?.(cue === 'hurry' ? [60, 60, 60] : 40)
  } catch {
    /* ignore */
  }
  if (!ctx || ctx.state !== 'running') return
  const t = ctx.currentTime
  NOTES[cue].forEach((freq, i) => {
    const osc = ctx!.createOscillator()
    const gain = ctx!.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const start = t + i * 0.14
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.12, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5)
    osc.connect(gain).connect(ctx!.destination)
    osc.start(start)
    osc.stop(start + 0.55)
  })
}
