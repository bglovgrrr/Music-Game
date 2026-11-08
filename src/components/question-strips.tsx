import { Shuffle } from 'lucide-react'
import { motion } from 'motion/react'
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const HOLD_MS = 280
const STRIP_SPRING = { type: 'spring', stiffness: 170, damping: 24, mass: 0.9 } as const

/** Small stable "randomness" per strip so the pile looks dropped by hand. */
function jitter(i: number, salt: number) {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x) - 0.5 // -0.5..0.5
}

/**
 * Questions as torn strips of paper piled on the table, overlapping, with a
 * "Surprise me" strip at the bottom. Tap a strip to ask it. Press and hold to spread the
 * pile apart so it's easier to read; let go and it gently settles back into a pile.
 */
export function QuestionStrips({
  prompts,
  topicOf,
  depthOf,
  used,
  onPick,
  onSurprise,
}: {
  prompts: string[]
  topicOf?: (p: string) => string | undefined
  depthOf?: (p: string) => number | undefined
  used: Set<string>
  onPick: (p: string) => void
  onSurprise: () => void
}) {
  const [spread, setSpread] = useState(false)
  const [lifted, setLifted] = useState<number | null>(null)
  const press = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null)

  const settle = () => {
    if (press.current) window.clearTimeout(press.current.timer)
    setLifted(null)
    setSpread(false)
  }
  const down = (i: number, e: React.PointerEvent) => {
    if (e.button !== 0) return
    settle()
    setLifted(i)
    press.current = {
      x: e.clientX,
      y: e.clientY,
      fired: false,
      timer: window.setTimeout(() => {
        if (!press.current) return
        press.current.fired = true
        setSpread(true)
        try {
          navigator.vibrate?.(10)
        } catch {
          /* ignore */
        }
      }, HOLD_MS),
    }
  }
  const move = (e: React.PointerEvent) => {
    const p = press.current
    if (p && !p.fired && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) {
      window.clearTimeout(p.timer)
      press.current = null
      setLifted(null)
    }
  }
  const click = (act: () => void) => {
    // A hold only spreads the pile; it never asks.
    const held = press.current?.fired
    press.current = null
    if (!held) act()
  }

  const items = [
    ...prompts.map((p) => ({ key: p, label: p, done: used.has(p), act: () => onPick(p) })),
    { key: '__surprise', label: '', done: false, act: onSurprise },
  ]

  return (
    <ul className="mx-auto grid w-full max-w-xl pb-1">
      {items.map((it, i) => {
        const surprise = it.key === '__surprise'
        return (
          <motion.li
            key={it.key}
            initial={{ opacity: 0, y: 18, rotate: jitter(i, 1) * 6 }}
            animate={{
              opacity: it.done ? 0.5 : 1,
              y: 0,
              marginTop: i === 0 ? 0 : spread ? 8 : -14,
              rotate: jitter(i, 1) * (spread ? 1 : 3.4),
              x: jitter(i, 2) * (spread ? 4 : 14),
              scale: lifted === i ? 1.025 : 1,
            }}
            transition={{ ...STRIP_SPRING, opacity: { duration: 0.2 } }}
            className="drop-on-table relative"
            style={{ zIndex: lifted === i ? 20 : i }}
          >
            <button
              onPointerDown={(e) => down(i, e)}
              onPointerMove={move}
              onPointerUp={settle}
              onPointerCancel={settle}
              onLostPointerCapture={settle}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => click(it.act)}
              disabled={it.done}
              className={cn(
                'paper paper-texture torn-both block w-full cursor-pointer px-5 pt-5 pb-5 short:pt-4 short:pb-4 text-left select-none [-webkit-touch-callout:none] disabled:cursor-default',
                surprise ? 'bg-[#f2c77f] text-[#2a1e18]' : 'bg-[var(--paper)] font-note text-[1.2rem] leading-snug italic',
              )}
              style={{ ['--tx' as string]: `${Math.round(jitter(i, 3) * 80)}px` }}
            >
              {surprise ? (
                <span className="flex items-center justify-center gap-2 font-display text-lg font-bold [font-stretch:80%]">
                  <Shuffle className="size-4" /> Surprise me
                </span>
              ) : (
                <>
                  {topicOf?.(it.label) && (
                    <span className="mb-0.5 flex items-center gap-1.5 font-mono text-[0.58rem] tracking-[0.16em] text-[#a0560b] uppercase not-italic">
                      <span className="flex gap-[2px]" aria-hidden>
                        {[1, 2, 3].map((n) => (
                          <span key={n} className={cn('size-1.5 rounded-full', n <= (depthOf?.(it.label) ?? 0) ? 'bg-[#a0560b]' : 'bg-[#a0560b]/20')} />
                        ))}
                      </span>
                      {topicOf(it.label)}
                    </span>
                  )}
                  {it.label}
                  {it.done && <span className="ml-2 font-mono text-[0.6rem] tracking-[0.14em] text-muted-foreground uppercase not-italic">asked</span>}
                </>
              )}
            </button>
          </motion.li>
        )
      })}
    </ul>
  )
}
