import { ArrowRight, Flag, Settings2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { GameSettings } from '@/components/game-settings'
import { AlbumArt, CrownedName, PlayerAvatar, PromptCard } from '@/components/game-ui'
import { IndexCard, IndexCardHeader } from '@/components/physical'
import { FanFavoriteBanner, Scoreboard } from '@/components/scoreboard'
import { SelfieCard } from '@/components/selfie'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { currentRound, playerById, voteResults } from '@/game/engine'
import { themeName } from '@/game/prompts'
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
          <h2 className="mt-1.5 text-4xl font-bold font-soft">What a mixtape.</h2>
        </div>
        <PromptCard prompt={round.prompt} topic={themeName(round.themeId)} asker={playerById(state, round.askerId)} compact />

        <div className="grid min-w-0 gap-2">
          <IndexCard tilt={-0.8} className="mt-1">
            <IndexCardHeader>
              <h3 className="text-xl leading-none font-bold font-soft">Song of the round</h3>
              <span className="font-mono text-xs tracking-[0.1em] text-muted-foreground">
                {voted}/{voters} VOTED
              </span>
            </IndexCardHeader>
            <p className="flex h-[1.75rem] items-center px-4 font-note text-[1.1rem] text-muted-foreground italic">
              {myVote ? 'Tap another song to change your vote.' : 'Tap your favourite (not your own).'}
            </p>
            <ul className="grid px-2">
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
                        'flex min-h-[3.5rem] w-full items-center gap-3 rounded-md px-2 py-1 text-left transition-colors',
                        !mine && 'cursor-pointer hover:bg-muted',
                        myVote === pid && 'bg-secondary',
                      )}
                    >
                      <AlbumArt track={p.track} className="size-11 shrink-0 shadow-sm" rounded="rounded-[3px]" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{p.track.title}</div>
                        {round.reactions?.[pid] && (
                          <div className="flex gap-2 pt-0.5 text-xs text-muted-foreground tabular-nums">
                            {Object.entries(round.reactions[pid])
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 3)
                              .map(([emoji, n]) => (
                                <span key={emoji}>
                                  {emoji} {n}
                                </span>
                              ))}
                          </div>
                        )}
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
          </IndexCard>
        </div>
      </div>

      <aside className="grid content-start gap-3 md:sticky md:top-20">
        <Card className="p-4">
          <SelfieCard round={round} />
        </Card>

        <Button variant="brand" size="lg" onClick={() => dispatch({ type: 'nextRound' })}>
          Next: {nextAsker.id === meId ? 'you ask' : `${nextAsker.name} asks`} <ArrowRight />
        </Button>

        <FanFavoriteBanner />

        <Card className="p-3 empty:hidden">
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
