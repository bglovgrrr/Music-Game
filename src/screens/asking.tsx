import { Send, Shuffle } from 'lucide-react'
import { motion } from 'motion/react'
import { useRef, useState } from 'react'
import { PlayerAvatar } from '@/components/game-ui'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { askerOf, MAX_PROMPT_LENGTH } from '@/game/engine'
import { ALL_PROMPTS } from '@/game/prompts'
import { useGame } from '@/hooks/use-game'
import { cn, sample } from '@/lib/utils'

export function AskingScreen() {
  const { state, dispatch, meId } = useGame()
  const asker = askerOf(state)!
  const [text, setText] = useState('')
  const used = new Set(state.rounds.map((r) => r.prompt))
  // A fresh handful of unused questions each round (a mix of themes).
  const [picks] = useState(() => shuffled(ALL_PROMPTS.filter((p) => !used.has(p.prompt))).slice(0, QUESTIONS_SHOWN))

  if (asker.id !== meId) {
    return (
      <div className="grid flex-1 place-content-center justify-items-center gap-5 py-10 text-center">
        <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
          <PlayerAvatar player={asker} size="xl" ring />
        </motion.div>
        <div>
          <h2 className="text-3xl font-bold font-soft">{asker.name} is asking</h2>
          <p className="mt-1 text-muted-foreground">Thinking of a question for the group…</p>
        </div>
        <span className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-2 rounded-full bg-accent"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
            />
          ))}
        </span>
      </div>
    )
  }

  const ask = (prompt: string, tid?: string) => dispatch({ type: 'ask', prompt, themeId: tid })

  return (
    <div className="mx-auto grid w-full max-w-2xl content-start gap-4 py-2">
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">Round {state.rounds.length + 1} · your turn</p>
        <h2 className="mt-1 text-[2rem] leading-tight font-bold font-soft">Ask the group a question</h2>
      </div>

      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) ask(text)
        }}
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your own… e.g. Pick a song that reminds you of high school"
          maxLength={MAX_PROMPT_LENGTH}
          className="min-h-0 pr-16 text-lg"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (text.trim()) ask(text)
            }
          }}
        />
        <Button type="submit" size="icon" variant="brand" className="absolute right-2.5 bottom-2.5" disabled={!text.trim()} aria-label="Ask">
          <Send />
        </Button>
      </form>

      <QuestionStrips
        prompts={picks.map((p) => p.prompt)}
        used={used}
        onPick={(p) => ask(p, picks.find((x) => x.prompt === p)?.themeId)}
        onSurprise={() => {
          const pool = ALL_PROMPTS.filter((p) => !used.has(p.prompt))
          const p = sample(pool.length ? pool : ALL_PROMPTS)
          ask(p.prompt, p.themeId)
        }}
      />
    </div>
  )
}

const QUESTIONS_SHOWN = 4
const HOLD_MS = 280
const STRIP_SPRING = { type: 'spring', stiffness: 170, damping: 24, mass: 0.9 } as const

function shuffled<T>(xs: T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

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
function QuestionStrips({ prompts, used, onPick, onSurprise }: { prompts: string[]; used: Set<string>; onPick: (p: string) => void; onSurprise: () => void }) {
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

  const items = [...prompts.map((p) => ({ key: p, label: p, done: used.has(p), act: () => onPick(p) })), { key: '__surprise', label: '', done: false, act: onSurprise }]

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
                'paper paper-texture torn-both block w-full cursor-pointer px-5 pt-5 pb-5 text-left select-none [-webkit-touch-callout:none] disabled:cursor-default',
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
