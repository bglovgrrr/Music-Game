import { CrownedName, PlayerAvatar } from '@/components/game-ui'
import { scores, voteResults } from '@/game/engine'
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

  if (!guessing && !Object.keys(crowns).length) return null
  return (
    <div className={cn('grid gap-1', className)}>
      {!compact && <h3 className="px-2 pb-1 text-lg font-medium font-soft">{guessing ? 'Scores' : 'Song of the round wins'}</h3>}
      {rows.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <PlayerAvatar player={p} size="sm" />
          <span className="min-w-0 flex-1 pt-1 text-sm font-medium">
            <CrownedName name={p.id === meId ? 'You' : p.name} crowned={!!crowns[p.id]} />
            {(crowns[p.id] ?? 0) > 1 && <span className="ml-1.5 text-xs text-muted-foreground">×{crowns[p.id]}</span>}
          </span>
          {guessing && (
            <span className={cn('w-8 text-right font-display text-lg tabular-nums', top > 0 && pts[p.id] === top && 'text-accent')}>{pts[p.id] ?? 0}</span>
          )}
        </div>
      ))}
      {guessing && <p className="px-2 pt-1 text-xs text-muted-foreground">1 point for each correct guess.</p>}
    </div>
  )
}
