import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import type { GameClient } from '@/game/client'
import { GameError } from '@/game/engine'
import type { Action } from '@/game/types'
import { clock } from '@/lib/clock'

export const GameContext = createContext<GameClient | null>(null)

export function useGame() {
  const client = useContext(GameContext)
  if (!client) throw new Error('useGame must be used inside a game')
  const state = useSyncExternalStore(client.subscribe, client.getState)
  const dispatch = (action: Action) => {
    try {
      client.dispatch(action)
    } catch (err) {
      toast.error(err instanceof GameError ? err.message : 'Something went wrong')
      if (!(err instanceof GameError)) console.error(err)
    }
  }
  const me = state.players.find((p) => p.id === client.meId)
  return { state, dispatch, client, me, meId: client.meId, isHost: state.hostId === client.meId }
}

/** Re-render on an interval while `active` (for progress bars). */
export function useNow(active: boolean, intervalMs = 250) {
  const [now, setNow] = useState(() => clock.now())
  useEffect(() => {
    if (!active) return
    const tick = () => setNow(clock.now())
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, intervalMs)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [active, intervalMs])
  return now
}
