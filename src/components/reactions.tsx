import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { REACTIONS, type Reaction } from '@/game/client'
import { playerById } from '@/game/engine'
import { useGame } from '@/hooks/use-game'
import { cn } from '@/lib/utils'

type Floating = Reaction & { x: number; name?: string; color?: string }

/** Emojis that float up the screen when anyone reacts. */
export function ReactionLayer() {
  const { client, state } = useGame()
  const [items, setItems] = useState<Floating[]>([])

  useEffect(
    () =>
      client.onReaction((r) => {
        const p = playerById(client.getState(), r.playerId)
        const item: Floating = { ...r, x: 8 + Math.random() * 74, name: p?.name, color: p?.color }
        setItems((list) => [...list.slice(-24), item])
        setTimeout(() => setItems((list) => list.filter((i) => i.id !== r.id)), 2600)
      }),
    [client],
  )

  if (state.phase !== 'listening') return null
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      <AnimatePresence>
        {items.map((r) => (
          <motion.div
            key={r.id}
            initial={{ y: 0, opacity: 0, scale: 0.6 }}
            animate={{ y: '-55vh', opacity: [0, 1, 1, 0], scale: 1 }}
            transition={{ duration: 2.4, ease: 'easeOut' }}
            className="absolute bottom-24 flex flex-col items-center gap-0.5"
            style={{ left: `${r.x}%` }}
          >
            <span className="text-4xl drop-shadow-sm">{r.emoji}</span>
            {r.name && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-ink" style={{ background: r.color }}>
                {r.name}
              </span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/** Row of reaction buttons. */
export function ReactionBar({ className }: { className?: string }) {
  const { client } = useGame()
  const [cooldown, setCooldown] = useState(false)
  const send = (emoji: string) => {
    if (cooldown) return
    client.react(emoji)
    setCooldown(true)
    setTimeout(() => setCooldown(false), 350)
  }
  return (
    <div className={cn('flex justify-center gap-1.5', className)} role="group" aria-label="React to this song">
      {REACTIONS.map((e) => (
        <button
          key={e}
          onClick={() => send(e)}
          className="grid size-11 cursor-pointer place-items-center rounded-full border bg-card text-xl transition active:scale-90 hover:bg-muted"
          aria-label={`React ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  )
}
