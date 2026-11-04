import { CrownedName, PlayerAvatar } from '@/components/game-ui'
import { fanFavorites, reactionTotals, scores, voteResults } from '@/game/engine'
import type { GameState } from '@/game/types'
import { useGame } from '@/hooks/use-game'
import { cn } from '@/lib/utils'

/** Song-of-the-round wins per player across the game. */
export function crownCounts(s: GameState) {
  const out: Record<string, number> = {}
  for (const r of s.rounds) for (const w of voteResults(r).winners) out[w] = (out[w] ?? 0) + 1
  return out
}

/** Guess points (if any rounds used guessing) and song-of-the-round crowns. */
export function Scoreboard({ className, compact }: { className?: string; compact?: boolean }) {
  const { state, meId } = useGame()
  const pts = scores(state)
  const crowns = crownCounts(state)
  const guessing = state.rounds.some((r) => r.guessMode)
  const rows = [...state.players].sort((a, b) => (pts[b.id] ?? 0) - (pts[a.id] ?? 0) || (crowns[b.id] ?? 0) - (crowns[a.id] ?? 0))
  const top = Math.max(0, ...Object.values(pts))
  const rx = reactionTotals(state)
  const favs = fanFavorites(state)
  const anyReactions = favs.length > 0

  if (!guessing && !Object.keys(crowns).length && !anyReactions) return null
  return (
    <div className={cn('grid gap-1', className)}>
      {!compact && (
        <h3 className="px-2 pb-1 text-lg font-medium font-soft">
          {guessing ? 'Scores' : Object.keys(crowns).length ? 'Song of the round wins' : 'Fan favorites'}
        </h3>
      )}
      {rows.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <PlayerAvatar player={p} size="sm" />
          <span className="min-w-0 flex-1 pt-1 text-sm font-medium">
            <CrownedName name={p.id === meId ? 'You' : p.name} crowned={!!crowns[p.id]} />
            {(crowns[p.id] ?? 0) > 1 && <span className="ml-1.5 text-xs text-muted-foreground">×{crowns[p.id]}</span>}
          </span>
          {anyReactions && (
            <span
              className={cn('flex min-w-12 items-center justify-end gap-1 text-sm tabular-nums', favs.includes(p.id) ? 'font-semibold' : 'text-muted-foreground')}
              title="Reactions their songs got"
            >
              <span className="text-base">{rx[p.id]?.top ?? '·'}</span>
              {rx[p.id]?.total ?? 0}
            </span>
          )}
          {guessing && (
            <span className={cn('w-8 text-right font-display text-lg tabular-nums', top > 0 && pts[p.id] === top && 'text-accent')}>{pts[p.id] ?? 0}</span>
          )}
        </div>
      ))}
      {(guessing || anyReactions) && (
        <p className="px-2 pt-1 text-xs text-muted-foreground">
          {[guessing && '1 point for each correct guess.', anyReactions && 'Emoji count = reactions their songs got from others.'].filter(Boolean).join(' ')}
        </p>
      )}
    </div>
  )
}

/** "Fan favorite: Maya · 87 reactions · mostly 🔥" (null until anyone has reacted). */
export function FanFavoriteBanner({ className }: { className?: string }) {
  const { state, meId } = useGame()
  const favs = fanFavorites(state)
  if (!favs.length) return null
  const rx = reactionTotals(state)
  const names = favs.map((id) => (id === meId ? 'You' : (state.players.find((p) => p.id === id)?.name ?? '?')))
  const total = rx[favs[0]].total
  const top = rx[favs[0]].top
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl border bg-card p-3', className)}>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--pastel-2)] text-2xl">{top ?? '🔥'}</span>
      <div className="grid min-w-0">
        <span className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">Fan favorite</span>
        <span className="truncate font-display text-xl font-medium font-soft">{names.join(' & ')}</span>
        <span className="text-xs text-muted-foreground">
          {total} reactions{favs.length > 1 ? ' each' : ''}
          {top ? ` · mostly ${top}` : ''}
        </span>
      </div>
    </div>
  )
}

