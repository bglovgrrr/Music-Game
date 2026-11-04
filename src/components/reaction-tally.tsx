import { useEffect, useRef } from 'react'
import { drainTally, type TallyBuffer, tallyReaction } from '@/game/reaction-tally'
import { useGame } from '@/hooks/use-game'

/**
 * Host's device only: counts every reaction (they arrive live, never saved) and saves the
 * totals into the game every few seconds, so Fan favorite works for everyone.
 */
export function ReactionTally() {
  const { client } = useGame()
  const buffer = useRef<TallyBuffer>(new Map())

  useEffect(() => {
    const off = client.onReaction((r) => tallyReaction(buffer.current, r))
    const flush = () => {
      for (const action of drainTally(buffer.current)) {
        try {
          client.dispatch(action)
        } catch {
          /* round gone, or no longer host: drop */
        }
      }
    }
    const timer = setInterval(flush, 4000)
    return () => {
      off()
      clearInterval(timer)
      flush()
    }
  }, [client])

  return null
}
