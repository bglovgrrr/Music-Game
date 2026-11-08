import { Send } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { PlayerAvatar } from '@/components/game-ui'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { askerOf, MAX_PROMPT_LENGTH } from '@/game/engine'
import { ALL_PROMPTS, dealQuestions, DEPTH_LABEL, THEMES } from '@/game/prompts'
import { useGame } from '@/hooks/use-game'
import { primeKeyboard } from '@/lib/keyboard'
import { cn, sample } from '@/lib/utils'
import { QuestionStrips } from '@/components/question-strips'

export function AskingScreen() {
  const { state, dispatch, meId } = useGame()
  const asker = askerOf(state)!
  const [text, setText] = useState('')
  const used = new Set(state.rounds.map((r) => r.prompt))
  // Four categories; each deals a light, a warm and a deep question (plus one) for this round.
  const [themeId, setThemeId] = useState(THEMES[0].id)
  const [hands] = useState(() => Object.fromEntries(THEMES.map((t) => [t.id, dealQuestions(t, used)])))
  const theme = THEMES.find((t) => t.id === themeId)!
  const hand = hands[themeId]

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

  const ask = (prompt: string, tid?: string) => {
    primeKeyboard() // the next screen is the song search: bring the keyboard up from this tap
    dispatch({ type: 'ask', prompt, themeId: tid })
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl content-start gap-4 py-2 short:gap-3">
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase short:hidden">Round {state.rounds.length + 1} · your turn</p>
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

      {/* category tabs: four paper tabs, the open one lifted and coloured in */}
      <div className="grid gap-2">
        <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label="Question categories">
          {THEMES.map((t, i) => {
            const on = t.id === themeId
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                onClick={() => setThemeId(t.id)}
                className={cn(
                  'paper on-table grid min-h-12 cursor-pointer place-items-center rounded-t-[8px] rounded-b-[3px] px-1.5 py-1.5 text-center font-display text-[0.8rem] leading-[1.05] font-bold [font-stretch:80%] transition-[transform,background-color] duration-200',
                  on ? 'bg-[#f2c77f] text-[#2a1e18] -translate-y-1' : 'bg-[var(--paper)] text-[#2a1e18]/70 hover:-translate-y-0.5',
                )}
                style={{ rotate: `${(i % 2 ? 1 : -1) * 0.8}deg` }}
              >
                {t.name}
              </button>
            )
          })}
        </div>
        <p className="px-1 font-note text-[1.05rem] text-muted-foreground italic short:hidden">{theme.blurb}</p>
      </div>

      <QuestionStrips
        key={themeId}
        prompts={hand.map((x) => x.text)}
        topicOf={(p) => {
          const d = hand.find((x) => x.text === p)?.depth
          return d ? DEPTH_LABEL[d] : undefined
        }}
        depthOf={(p) => hand.find((x) => x.text === p)?.depth}
        used={used}
        onPick={(p) => ask(p, themeId)}
        onSurprise={() => {
          const pool = ALL_PROMPTS.filter((p) => !used.has(p.prompt))
          const p = sample(pool.length ? pool : ALL_PROMPTS)
          ask(p.prompt, p.themeId)
        }}
      />
    </div>
  )
}
