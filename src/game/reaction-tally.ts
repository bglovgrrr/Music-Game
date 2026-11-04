import type { Reaction } from './client'

/** Pending reaction counts per song, waiting to be saved: key "roundId|owner" -> emoji -> count. */
export type TallyBuffer = Map<string, Record<string, number>>

/** Count one reaction toward the song it was sent during. Your own song doesn't count. */
export function tallyReaction(buffer: TallyBuffer, r: Reaction) {
  if (!r.roundId || !r.owner || r.owner === r.playerId) return
  const key = `${r.roundId}|${r.owner}`
  const counts = buffer.get(key) ?? {}
  counts[r.emoji] = (counts[r.emoji] ?? 0) + 1
  buffer.set(key, counts)
}

/** Take everything pending as save actions, and empty the buffer. */
export function drainTally(buffer: TallyBuffer) {
  const out = [...buffer.entries()].map(([key, counts]) => {
    const [roundId, owner] = key.split('|')
    return { type: 'reactions' as const, roundId, owner, counts }
  })
  buffer.clear()
  return out
}
