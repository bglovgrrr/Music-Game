import { CassetteTape, Dices, HeartCrack, House, MapPinned, Send, Shuffle, Waves, Zap, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
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
        <motion.ul key={themeId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-2 sm:grid-cols-2">
          {theme.prompts.map((p) => (
            <li key={p}>
              <button
                onClick={() => ask(p, theme.id)}
                disabled={used.has(p)}
                className="paper paper-texture on-table flex h-full w-full cursor-pointer items-center rounded-[3px] bg-card p-4 text-left font-note text-[1.2rem] leading-snug italic transition hover:-translate-y-0.5 hover:border-ring/60 hover:shadow-md disabled:cursor-default disabled:opacity-40 disabled:hover:translate-y-0"
              >
                {p}
              </button>
            </li>
          ))}
        </motion.ul>
      </div>
    </div>
  )
}
