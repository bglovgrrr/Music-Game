import { ArrowRight, Crown, ExternalLink, Loader2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Sticker } from '@/components/sticker'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { themeName } from '@/game/prompts'
import { cn } from '@/lib/utils'
import { loadWrap, type WrapSnapshot } from '@/lib/wrap'

/**
 * The public page behind a share link: a read-only look at someone's game night,
 * with every song one tap from Spotify, and an invitation to start your own.
 */
export function WrapScreen({ id, onDone }: { id: string; onDone: () => void }) {
  const [wrap, setWrap] = useState<WrapSnapshot | null | undefined>(undefined)
  const [at, setAt] = useState(0)

  useEffect(() => {
    let live = true
    loadWrap(id)
      .then((w) => live && setWrap(w))
      .catch(() => live && setWrap(null))
    return () => {
      live = false
    }
  }, [id])

  if (wrap === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (!wrap) {
    return (
      <div className="mx-auto grid min-h-dvh max-w-md content-center justify-items-center gap-4 px-6 text-center">
        <h1 className="text-3xl font-bold font-soft">This mixtape got lost</h1>
        <p className="text-muted-foreground">The link may be wrong, or the game was removed.</p>
        <Button variant="brand" size="lg" onClick={onDone}>
          Start your own mixtape <ArrowRight />
        </Button>
      </div>
    )
  }

  const songs = wrap.rounds.reduce((n, r) => n + r.songs.length, 0)
  const date = new Date(wrap.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col gap-3 px-4 pt-safe pb-[max(env(safe-area-inset-bottom),1rem)]">
      <header className="flex h-12 shrink-0 items-center justify-between">
        <span className="font-mono text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">A shared mixtape</span>
        <ThemeToggle />
      </header>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid gap-1">
        <h1 className="text-4xl leading-none font-bold font-soft">
          {date} <em className="brand-text pr-1">mixtape.</em>
        </h1>
        <p className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
          {wrap.players.length} friends · {wrap.rounds.length} {wrap.rounds.length === 1 ? 'question' : 'questions'} · {songs} songs
        </p>
        <div className="flex -space-x-1 pt-1.5">
          {wrap.players.map((p) => (
            <span key={p.name} className="size-7" title={p.name}>
              <Sticker player={{ id: p.name, color: p.color }} color={p.color} className="size-full" />
            </span>
          ))}
        </div>
      </motion.div>

      {wrap.fanFavorite && (
        <Card className="flex items-center gap-3 p-2.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--pastel-2)] text-xl">{wrap.fanFavorite.top ?? '🔥'}</span>
          <div className="min-w-0">
            <p className="font-mono text-[0.6rem] tracking-[0.14em] text-accent uppercase">Fan favorite</p>
            <p className="truncate font-display text-lg leading-tight font-bold [font-stretch:80%]">{wrap.fanFavorite.names.join(' & ')}</p>
          </div>
          <span className="ml-auto text-xs text-muted-foreground">{wrap.fanFavorite.total} reactions</span>
        </Card>
      )}

      {/* rounds as swipeable J-cards */}
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div
          className="no-scrollbar -mx-4 flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-1"
          onScroll={(e) => {
            const el = e.currentTarget
            setAt(Math.round(el.scrollLeft / Math.max(1, el.scrollWidth / wrap.rounds.length)))
          }}
        >
          {wrap.rounds.map((r, i) => (
            <Card key={i} className="flex w-[86%] shrink-0 snap-center flex-col p-3" style={{ transform: `rotate(${i % 2 ? 0.6 : -0.6}deg)` }}>
              <div className="px-1 pb-2">
                <p className="font-mono text-[0.6rem] tracking-[0.14em] text-muted-foreground uppercase">
                  Side {String.fromCharCode(65 + (i % 26))}
                  {themeName(r.themeId) ? ` · ${themeName(r.themeId)}` : ''}
                  {r.asker ? ` · ${r.asker} asked` : ''}
                </p>
                <p className="line-clamp-2 font-note text-lg leading-snug italic">{r.prompt}</p>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {r.songs.map((s, j) => (
                  <li key={j}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-md p-1.5 hover:bg-muted">
                      {s.artwork ? (
                        <img src={s.artwork} alt="" className="size-11 shrink-0 rounded-[3px] object-cover shadow-sm" />
                      ) : (
                        <span className="size-11 shrink-0 rounded-[3px]" style={{ background: s.color }} />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{s.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{s.artist}</span>
                      </span>
                      <span className={cn('flex shrink-0 items-center gap-1 text-xs', s.crowned ? 'font-semibold' : 'text-muted-foreground')}>
                        {s.crowned && <Crown className="size-3.5 text-[#c48a10]" fill="#f5c84c" />}
                        {s.by}
                      </span>
                      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        {wrap.rounds.length > 1 && (
          <div className="flex justify-center gap-1.5" aria-hidden>
            {wrap.rounds.map((_, i) => (
              <span key={i} className={cn('h-1.5 rounded-full transition-all', i === at ? 'w-4 bg-accent' : 'w-1.5 bg-foreground/25')} />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-1.5">
        <Button variant="brand" size="lg" onClick={onDone}>
          Start your own mixtape <ArrowRight />
        </Button>
        <p className="text-center text-xs text-muted-foreground">Mixtape Memories: a music storytelling game for friends in one room.</p>
      </div>
    </div>
  )
}
