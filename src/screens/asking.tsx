import { CassetteTape, Dices, HeartCrack, House, MapPinned, Send, Shuffle, Waves, Zap, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useRef, useState } from 'react'
import { PlayerAvatar } from '@/components/game-ui'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { askerOf, MAX_PROMPT_LENGTH } from '@/game/engine'
import { ALL_PROMPTS, THEMES } from '@/game/prompts'
import { useGame } from '@/hooks/use-game'
import { cn, sample } from '@/lib/utils'

const THEME_STYLE: Record<string, { icon: LucideIcon; tint: string }> = {
  throwback: { icon: CassetteTape, tint: 'var(--pastel-1)' },
  family: { icon: House, tint: 'var(--pastel-3)' },
  love: { icon: HeartCrack, tint: 'var(--pastel-2)' },
  hype: { icon: Zap, tint: '#fbe39a' },
  deep: { icon: Waves, tint: '#bcdcff' },
  places: { icon: MapPinned, tint: 'var(--pastel-4)' },
  wild: { icon: Dices, tint: '#e3d4ff' },
}

export function AskingScreen() {
  const { state, dispatch, meId } = useGame()
  const asker = askerOf(state)!
  const [themeId, setThemeId] = useState(THEMES[0].id)
  const [text, setText] = useState('')
  const theme = THEMES.find((t) => t.id === themeId)!
  const used = new Set(state.rounds.map((r) => r.prompt))

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
    <div className="mx-auto grid w-full max-w-2xl gap-6 py-4">
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">Round {state.rounds.length + 1} · your turn</p>
        <h2 className="mt-1.5 text-4xl font-bold font-soft">Ask the group a question</h2>
        <p className="mt-1 text-muted-foreground">Everyone answers with a song.</p>
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
          className="pr-16 text-lg"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (text.trim()) ask(text)
            }
          }}
        />
        <Button type="submit" size="icon" variant="brand" className="absolute right-3 bottom-3" disabled={!text.trim()} aria-label="Ask">
          <Send />
        </Button>
      </form>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Or pick from a theme</h3>
          <Button variant="ghost" size="sm" onClick={() => { const p = sample(ALL_PROMPTS); ask(p.prompt, p.themeId) }}>
            <Shuffle /> Surprise me
          </Button>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {THEMES.map((t) => {
            const { icon: Icon, tint } = THEME_STYLE[t.id]
            const on = t.id === themeId
            return (
              <button
                key={t.id}
                onClick={() => setThemeId(t.id)}
                aria-pressed={on}
                className={cn(
                  'flex shrink-0 cursor-pointer items-center gap-2 rounded-full border py-1.5 pr-4 pl-1.5 text-sm font-medium transition-all',
                  on ? 'border-transparent text-ink shadow-sm' : 'paper on-table bg-card hover:brightness-105',
                )}
                style={on ? { background: tint } : undefined}
              >
                <span className="grid size-7 place-items-center rounded-full text-ink" style={{ background: on ? 'rgb(255 255 255 / 0.55)' : tint }}>
                  <Icon className="size-3.5" />
                </span>
                {t.name}
              </button>
            )
          })}
        </div>
        <QuestionStrips key={themeId} prompts={theme.prompts} used={used} onPick={(p) => ask(p, theme.id)} />
      </div>
    </div>
  )
}

const HOLD_MS = 320
const STRIP_SPRING = { type: 'spring', stiffness: 260, damping: 26 } as const

/** Small stable "randomness" per strip so the pile looks dropped by hand. */
function jitter(i: number, salt: number) {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x) - 0.5 // -0.5..0.5
}

/**
 * The theme's questions as torn strips of paper piled on the table, overlapping.
 * Tap a strip to ask it. Press and hold anywhere on the pile to spread the strips apart
 * (hold again to pile them back up).
 */
function QuestionStrips({ prompts, used, onPick }: { prompts: string[]; used: Set<string>; onPick: (p: string) => void }) {
  const [spread, setSpread] = useState(false)
  const [lifted, setLifted] = useState<number | null>(null)
  const press = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null)

  const cancel = () => {
    if (press.current) window.clearTimeout(press.current.timer)
    setLifted(null)
  }
  const down = (i: number, e: React.PointerEvent) => {
    if (e.button !== 0) return
    cancel()
    setLifted(i)
    press.current = {
      x: e.clientX,
      y: e.clientY,
      fired: false,
      timer: window.setTimeout(() => {
        if (!press.current) return
        press.current.fired = true
        setSpread((v) => !v)
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
  const up = () => {
    if (press.current) window.clearTimeout(press.current.timer)
    setLifted(null)
  }
  const click = (p: string) => {
    // A hold spreads the pile; it shouldn't also pick the question.
    if (press.current?.fired) {
      press.current = null
      return
    }
    press.current = null
    onPick(p)
  }

  return (
    <div className="grid gap-2 pt-1">
      <ul className="mx-auto grid w-full max-w-xl pb-2">
        {prompts.map((p, i) => {
          const done = used.has(p)
          return (
            <motion.li
              key={p}
              initial={{ opacity: 0, y: 18, rotate: jitter(i, 1) * 6 }}
              animate={{
                opacity: done ? 0.5 : 1,
                y: 0,
                marginTop: i === 0 ? 0 : spread ? 10 : -16,
                rotate: jitter(i, 1) * (spread ? 1.2 : 3.4),
                x: jitter(i, 2) * (spread ? 4 : 14),
                scale: lifted === i ? 1.025 : 1,
              }}
              transition={{ ...STRIP_SPRING, delay: 0, opacity: { duration: 0.2 } }}
              className="drop-on-table relative"
              style={{ zIndex: lifted === i ? 20 : i }}
            >
              <button
                onPointerDown={(e) => down(i, e)}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={cancel}
                onPointerLeave={up}
                onContextMenu={(e) => e.preventDefault()}
                onClick={() => click(p)}
                disabled={done}
                className="paper paper-texture torn-both block w-full cursor-pointer bg-[var(--paper)] px-5 pt-6 pb-6 text-left font-note text-[1.25rem] leading-snug italic select-none [-webkit-touch-callout:none] disabled:cursor-default"
                style={{ ['--tx' as string]: `${Math.round(jitter(i, 3) * 80)}px` }}
              >
                {p}
                {done && <span className="ml-2 font-mono text-[0.6rem] tracking-[0.14em] text-muted-foreground uppercase not-italic">asked</span>}
              </button>
            </motion.li>
          )
        })}
      </ul>
      <p className="text-center font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
        Tap to ask · hold to {spread ? 'pile them up' : 'spread them out'}
      </p>
    </div>
  )
}

