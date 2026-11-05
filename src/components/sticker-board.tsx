import { AnimatePresence, motion } from 'motion/react'
import { PlayerAvatar } from '@/components/game-ui'
import type { Player } from '@/game/types'
import { cn } from '@/lib/utils'

/**
 * Player stickers stuck straight onto the table: no card behind them, four to a row.
 * `outlines`: how many dotted outlines to show before anyone fills them (the lobby uses 4).
 * Beyond that, rows only grow as players arrive: never a row of empty outlines.
 */
export function StickerBoard({
  players,
  meId,
  hostId,
  outlines = 0,
  status,
  className,
}: {
  players: Player[]
  meId: string
  hostId?: string
  outlines?: number
  /** Optional per-player line under the name, e.g. Ready / Choosing… `done: false` dims the sticker. */
  status?: (p: Player) => { label: string; done: boolean }
  className?: string
}) {
  const slots = Math.max(outlines, players.length)
  return (
    <ul className={cn('grid grid-cols-4 gap-x-3 gap-y-3', className)}>
      {Array.from({ length: slots }, (_, i) => {
        const p = players[i]
        const st = p && status?.(p)
        return (
          <li key={p?.id ?? `empty-${i}`} className="grid justify-items-center gap-1">
            <div className={cn('relative grid aspect-square w-full place-items-center rounded-[22%]', !p && 'border-2 border-dashed border-foreground/25')}>
              <AnimatePresence>
                {p && (
                  <motion.div
                    key={p.id}
                    initial={{ scale: 1.7, opacity: 0, y: -24, rotate: -25 }}
                    animate={{ scale: 1, opacity: st && !st.done ? 0.55 : 1, y: 0, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 17 }}
                    className="absolute inset-[-4%]"
                  >
                    <PlayerAvatar player={p} done={st?.done} className="size-full" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className={cn('max-w-full truncate text-center text-xs font-semibold', !p && 'invisible')}>{p ? (p.id === meId ? 'You' : p.name) : '·'}</span>
            {p && (st || p.id === hostId) && (
              <span className={cn('-mt-1 font-mono text-[0.6rem] tracking-[0.12em] uppercase', st?.done ? 'text-success' : 'text-muted-foreground')}>
                {st ? st.label : 'Host'}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
