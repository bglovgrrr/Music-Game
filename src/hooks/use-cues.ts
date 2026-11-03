import { useEffect, useRef } from 'react'
import { askerOf, currentRound } from '@/game/engine'
import type { GameState } from '@/game/types'
import { chime } from '@/lib/chime'
import { clock } from '@/lib/clock'

/** Plays a chime when something needs your attention, so you can put your phone down. */
export function useCues(state: GameState, meId: string) {
  const prev = useRef<{ phase: string; rounds: number } | null>(null)
  const hurried = useRef<string | null>(null)
  const round = currentRound(state)

  useEffect(() => {
    const before = prev.current
    prev.current = { phase: state.phase, rounds: state.rounds.length }
    if (!before) return
    const changed = before.phase !== state.phase || before.rounds !== state.rounds.length
    if (!changed) return
    if (state.phase === 'asking' && askerOf(state)?.id === meId) chime('turn')
    else if (state.phase === 'picking' && round?.askerId !== meId) chime('pick')
  }, [state, meId, round?.askerId])

  // "10 seconds left" when you still haven't picked
  const deadline = round?.pickDeadline
  const picked = !!round?.picks.some((p) => p.playerId === meId)
  useEffect(() => {
    if (state.phase !== 'picking' || !deadline || picked || !round) return
    const ms = deadline - 10_000 - clock.now()
    if (ms < 0) return
    const t = setTimeout(() => {
      if (hurried.current === round.id) return
      hurried.current = round.id
      chime('hurry')
    }, ms)
    return () => clearTimeout(t)
  }, [state.phase, deadline, picked, round])
}
