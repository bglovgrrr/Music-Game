import { useState } from 'react'
import { CrownedName, PlayerAvatar, TrackRow } from '@/components/game-ui'
import { Card } from '@/components/ui/card'
import { playerById, voteResults } from '@/game/engine'
import { themeName } from '@/game/prompts'
import type { Round } from '@/game/types'
import { useGame } from '@/hooks/use-game'
import { cn } from '@/lib/utils'

/** Each round as a J-card you swipe through sideways. */
export function RoundCarousel({ rounds }: { rounds: Round[] }) {
  const { state } = useGame()
  const [at, setAt] = useState(0)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div
        className="no-scrollbar -mx-4 flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-1"
        tabIndex={0}
        role="region"
        aria-label="Rounds (swipe sideways)"
        onScroll={(e) => {
          const el = e.currentTarget
          setAt(Math.round(el.scrollLeft / Math.max(1, el.scrollWidth / rounds.length)))
        }}
      >
        {rounds.map((r, i) => (
          <Card key={r.id} className="flex w-[86%] shrink-0 snap-center flex-col p-3" style={{ transform: `rotate(${i % 2 ? 0.6 : -0.6}deg)` }}>
            <div className="flex items-start gap-2.5 px-1 pb-2">
              {playerById(state, r.askerId) && <PlayerAvatar player={playerById(state, r.askerId)!} size="sm" />}
              <div className="min-w-0">
                <p className="font-mono text-[0.6rem] tracking-[0.14em] text-muted-foreground uppercase">
                  Side {String.fromCharCode(65 + (i % 26))}
                  {themeName(r.themeId) ? ` · ${themeName(r.themeId)}` : ''}
                </p>
                <p className="line-clamp-2 font-note text-lg leading-snug italic">{r.prompt}</p>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" tabIndex={0} role="region" aria-label={`Songs for “${r.prompt}”`}>
              {r.order.map((pid) => {
                const p = r.picks.find((x) => x.playerId === pid)!
                const who = playerById(state, pid)
                const crowned = voteResults(r).winners.includes(pid)
                return (
                  <TrackRow
                    key={pid}
                    track={p.track}
                    right={
                      <CrownedName
                        name={who?.name ?? ''}
                        crowned={crowned}
                        className={cn('pt-1 text-sm', crowned ? 'font-semibold text-foreground' : 'text-muted-foreground')}
                      />
                    }
                  />
                )
              })}
            </div>
          </Card>
        ))}
      </div>
      {rounds.length > 1 && (
        <div className="flex justify-center gap-1.5" aria-hidden>
          {rounds.map((r, i) => (
            <span key={r.id} className={cn('h-1.5 rounded-full transition-all', i === at ? 'w-4 bg-accent' : 'w-1.5 bg-foreground/25')} />
          ))}
        </div>
      )}
    </div>
  )
}
