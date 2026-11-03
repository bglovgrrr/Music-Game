import { ArrowRight, Flag, Settings2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { GameSettings } from '@/components/game-settings'
import { AlbumArt, CrownedName, PlayerAvatar, PromptCard } from '@/components/game-ui'
import { Scoreboard } from '@/components/scoreboard'
import { SelfieCard } from '@/components/selfie'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { currentRound, playerById, voteResults } from '@/game/engine'
import { useGame } from '@/hooks/use-game'
import { cn } from '@/lib/utils'

export function BetweenScreen() {
  const { state, dispatch, isHost, meId } = useGame()
  const [showSettings, setShowSettings] = useState(false)
  const round = currentRound(state)!
  const nextAsker = state.players[(state.turn + 1) % state.players.length]
  const { counts, winners } = voteResults(round)
  const myVote = round.votes?.[meId]
  const voters = state.players.length
  const voted = Object.keys(round.votes ?? {}).length

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto grid w-full max-w-4xl gap-6 py-6 md:grid-cols-[1fr_300px] md:gap-8">
      <div className="grid min-w-0 content-start gap-5">
        <div className="text-center">
          <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">Round {round.number} complete</p>
          <h2 className="mt-1.5 text-4xl font-medium font-soft">What a mixtape.</h2>
        </div>
        <PromptCard prompt={round.prompt} asker={playerById(state, round.askerId)} compact />

        <div className="grid gap-2">
          <div className="flex items-baseline justify-between px-1">
            <h3 className="text-lg font-medium font-soft">Song of the round</h3>
            <span className="text-xs text-muted-foreground">
              {voted}/{voters} voted
            </span>
          </div>
          <p className="px-1 text-sm text-muted-foreground">{myVote ? 'Tap another song to change your vote.' : 'Tap your favourite (not your own).'}</p>
          <Card className="p-2">
            <ul className="grid gap-1">
              {round.order.map((pid) => {
                const p = round.picks.find((x) => x.playerId === pid)!
                const who = playerById(state, pid)
                const mine = pid === meId
                const isWinner = winners.includes(pid)
                return (
                  <li key={pid}>
                    <button
                      disabled={mine}
                      onClick={() => dispatch({ type: 'vote', owner: pid })}
                      aria-pressed={myVote === pid}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors',
                        !mine && 'cursor-pointer hover:bg-muted',
                        myVote === pid && 'bg-secondary',
                      )}
                    >
                      <AlbumArt track={p.track} className="size-12 shrink-0" rounded="rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{p.track.title}</div>
                        <div className="flex min-w-0 items-baseline gap-1 pt-1 text-sm text-muted-foreground">
                          <span className="truncate">{p.track.artist} ·</span>
                          <CrownedName name={mine ? 'you' : (who?.name ?? '')} crowned={isWinner} className={cn('shrink-0', isWinner && 'font-semibold text-foreground')} />
                        </div>
                      </div>
                      {!!counts[pid] && (
                        <span className="flex items-center gap-0.5 text-sm font-semibold tabular-nums">
                          {'♥'} {counts[pid]}
                        </span>
                      )}
                      {who && <PlayerAvatar player={who} size="sm" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      </div>

      <aside className="grid content-start gap-3 md:sticky md:top-20">
        <Card className="p-4">
          <SelfieCard round={round} />
        </Card>

        <Button variant="brand" size="lg" onClick={() => dispatch({ type: 'nextRound' })}>
          Next: {nextAsker.id === meId ? 'you ask' : `${nextAsker.name} asks`} <ArrowRight />
        </Button>

        <Card className="p-3">
          <Scoreboard />
        </Card>

        {isHost && (
          <>
            <Button variant="ghost" onClick={() => setShowSettings((v) => !v)} aria-expanded={showSettings}>
              <Settings2 /> {showSettings ? 'Hide settings' : 'Change settings'}
            </Button>
            {showSettings && (
              <Card className="p-4">
                <GameSettings />
              </Card>
            )}
            <Button variant="ghost" onClick={() => dispatch({ type: 'end' })}>
              <Flag /> End game & see recap
            </Button>
          </>
        )}
      </aside>
    </motion.div>
  )
}
