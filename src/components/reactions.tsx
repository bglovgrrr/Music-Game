import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { REACTIONS, type Reaction } from '@/game/client'
import { playerById } from '@/game/engine'
import { inkColor } from '@/game/colors'
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
          color: inkColor(p?.color),
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

/** Holding powers the button up through 4 levels, one every LEVEL_MS: each level-up wobbles and grows. */
export const MAX_LEVEL = 4
const LEVEL_MS = 1800
/** Button scale at each level (index = level). */
const LEVEL_SCALE = [1, 1.1, 1.22, 1.34, 1.48]
const WOBBLE = { rotate: [0, -16, 13, -9, 6, -2, 0], scale: [1, 1.4, 0.92, 1.12, 1] }

/**
 * Reaction buttons. Tap for one emoji; press and hold for a steady stream until you let go
 * (speeding up a little the longer you hold).
 */
export function ReactionBar({ className }: { className?: string }) {
  const { client } = useGame()
  const [holding, setHolding] = useState<string | null>(null)
  const [level, setLevel] = useState(0)
  const timer = useRef<number | undefined>(undefined)
  const levelTimer = useRef<number | undefined>(undefined)

  const stop = () => {
    window.clearTimeout(timer.current)
    window.clearInterval(levelTimer.current)
    timer.current = undefined
    levelTimer.current = undefined
    setHolding(null)
    setLevel(0)
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
    setLevel(1)
    send(emoji)
    levelTimer.current = window.setInterval(() => {
      setLevel((l) => {
        if (l >= MAX_LEVEL) return l
        try {
          navigator.vibrate?.(12 + l * 8)
        } catch {
          /* ignore */
        }
        return l + 1
      })
    }, LEVEL_MS)
    let interval = HOLD.start
    const loop = () => {
      send(emoji)
      interval = Math.max(HOLD.fastest, interval - 4)
      timer.current = window.setTimeout(loop, interval)
    }
    timer.current = window.setTimeout(loop, HOLD.firstDelay)
  }

  return (
    <div className={cn('flex justify-center gap-1.5', className)} role="group" aria-label="React to this song (hold for more; it powers up 4 times)">
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
          data-level={holding === e ? level : 0}
          animate={{ scale: holding === e ? LEVEL_SCALE[level] : 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 14 }}
          whileTap={holding ? undefined : { scale: 0.9 }}
          className={cn(
            'relative grid size-11 cursor-pointer touch-none place-items-center rounded-full border bg-card text-xl select-none hover:bg-muted [-webkit-touch-callout:none]',
            holding === e && 'z-10 border-transparent bg-secondary',
          )}
          style={holding === e ? { boxShadow: `0 0 0 ${2 + level * 2}px var(--pastel-2)` } : undefined}
          aria-label={`React ${e}`}
        >
          {/* Re-keyed on each level so the wobble plays once per level-up */}
          <motion.span
            key={holding === e ? `lvl-${level}` : 'idle'}
            className="pointer-events-none block"
            animate={holding === e ? WOBBLE : { rotate: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          >
            {e}
          </motion.span>
        </motion.button>
      ))}
    </div>
  )
}
