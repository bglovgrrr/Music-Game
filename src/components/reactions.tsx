import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { REACTIONS, type Reaction } from '@/game/client'
import { playerById } from '@/game/engine'
import { useGame } from '@/hooks/use-game'
import { cn } from '@/lib/utils'

/** Emojis that float up the screen when anyone reacts. */
/** Gentle, varied floats so a stream of emojis looks lively, not mechanical. */
type Floating = Reaction & { x: number; drift: number; tilt: number; size: number; name?: string; color?: string }

export function ReactionLayer() {
  const { client, state } = useGame()
  const [items, setItems] = useState<Floating[]>([])
  const lastByPlayer = useRef<Record<string, number>>({})

  useEffect(
    () =>
      client.onReaction((r) => {
        const p = playerById(client.getState(), r.playerId)
        // Only label the first emoji of a burst with the sender's name.
        const now = Date.now()
        const inBurst = now - (lastByPlayer.current[r.playerId] ?? 0) < 1200
        lastByPlayer.current[r.playerId] = now
        const item: Floating = {
          ...r,
          x: 8 + Math.random() * 78,
          drift: (Math.random() - 0.5) * 60,
          tilt: (Math.random() - 0.5) * 30,
          size: 0.85 + Math.random() * 0.45,
          name: inBurst ? undefined : p?.name,
          color: p?.color,
        }
        setItems((list) => [...list.slice(-40), item])
        setTimeout(() => setItems((list) => list.filter((i) => i.id !== r.id)), 2800)
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
            initial={{ y: 0, x: 0, opacity: 0, scale: 0.4, rotate: 0 }}
            animate={{
              y: '-58vh',
              x: [0, r.drift * 0.6, r.drift, r.drift * 0.7],
              opacity: [0, 1, 1, 0],
              scale: [0.4, r.size * 1.15, r.size],
              rotate: [0, r.tilt, -r.tilt * 0.5, r.tilt * 0.3],
            }}
            transition={{ duration: 2.6, ease: 'easeOut' }}
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

/** First repeat delay, starting interval, fastest interval (ms). Stays under ~8 per second. */
const HOLD = { firstDelay: 260, start: 150, fastest: 120 }

/**
 * Reaction buttons. Tap for one emoji; press and hold for a steady stream until you let go
 * (speeding up a little the longer you hold).
 */
export function ReactionBar({ className }: { className?: string }) {
  const { client } = useGame()
  const [holding, setHolding] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const stop = () => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    setHolding(null)
  }
  useEffect(() => stop, [])

  const send = (emoji: string) => {
    client.react(emoji)
    try {
      navigator.vibrate?.(6)
    } catch {
      /* ignore */
    }
  }

  const start = (emoji: string, e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    stop()
    setHolding(emoji)
    send(emoji)
    let interval = HOLD.start
    const loop = () => {
      send(emoji)
      interval = Math.max(HOLD.fastest, interval - 4)
      timer.current = window.setTimeout(loop, interval)
    }
    timer.current = window.setTimeout(loop, HOLD.firstDelay)
  }

  return (
    <div className={cn('flex justify-center gap-1.5', className)} role="group" aria-label="React to this song (hold for more)">
      {REACTIONS.map((e) => (
        <motion.button
          key={e}
          onPointerDown={(ev) => start(e, ev)}
          onPointerUp={stop}
          onPointerCancel={stop}
          onLostPointerCapture={stop}
          onContextMenu={(ev) => ev.preventDefault()}
          // Keyboard: one per press
          onKeyDown={(ev) => {
            if ((ev.key === 'Enter' || ev.key === ' ') && !ev.repeat) {
              ev.preventDefault()
              send(e)
            }
          }}
          animate={holding === e ? { scale: [1.12, 1.22, 1.12] } : { scale: 1 }}
          transition={holding === e ? { duration: 0.45, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring', stiffness: 400, damping: 15 }}
          whileTap={{ scale: 0.9 }}
          className={cn(
            'grid size-11 cursor-pointer touch-none place-items-center rounded-full border bg-card text-xl select-none hover:bg-muted [-webkit-touch-callout:none]',
            holding === e && 'border-transparent bg-secondary shadow-[0_0_0_4px_var(--pastel-2)]',
          )}
          aria-label={`React ${e}`}
        >
          {e}
        </motion.button>
      ))}
    </div>
  )
}
