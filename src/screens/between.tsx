import { ArrowRight, Camera, Flag } from 'lucide-react'
import { motion } from 'motion/react'
import { GameSettings } from '@/components/game-settings'
import { AlbumArt, CrownedName, PlayerAvatar } from '@/components/game-ui'
import { PeekSheet } from '@/components/sheet'
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
  const round = currentRound(state)!
  const nextAsker = state.players[(state.turn + 1) % state.players.length]
  const { counts, winners } = voteResults(round)
  const myVote = round.votes?.[meId]
  const voters = state.players.length
  const voted = Object.keys(round.votes ?? {}).length

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 pt-1 pb-24">
      {/* Goal: pick the song of the round, then move on. Selfie, scores and settings live in the sheet. */}
      <div className="grid min-w-0 gap-2">
        <div>
          <p className="font-mono text-[0.65rem] tracking-[0.16em] text-accent uppercase">Round {round.number} complete{themeName(round.themeId) ? ` · ${themeName(round.themeId)}` : ''}</p>
          <p className="mt-1 line-clamp-2 font-note text-xl leading-snug italic">“{round.prompt}”</p>
        </div>
        <div className="grid min-w-0 gap-2">
          <IndexCard tilt={-0.8} className="mt-1">
            <IndexCardHeader>
              <h2 className="text-xl leading-none font-bold font-soft">Song of the round</h2>
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
                        'flex min-h-[3.25rem] w-full items-center gap-3 rounded-md px-2 py-0.5 text-left transition-colors',
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

      <Button variant="brand" size="lg" className="mt-auto" onClick={() => dispatch({ type: 'nextRound' })}>
        Next: {nextAsker.id === meId ? 'you ask' : `${nextAsker.name} asks`} <ArrowRight />
      </Button>

      <PeekSheet label="Selfie & scores" summary={round.photo ? 'Selfie saved' : 'Take a group selfie'} icon={<Camera />}>
        <div className="grid gap-4 pt-1">
          <Card className="p-4">
            <SelfieCard round={round} />
          </Card>
          <FanFavoriteBanner />
          <Card className="p-3 empty:hidden">
            <Scoreboard />
          </Card>
          {isHost && (
            <>
              <Card className="p-4">
                <GameSettings />
              </Card>
              <Button variant="sketch" onClick={() => dispatch({ type: 'end' })}>
                <Flag /> End game & see the recap
              </Button>
            </>
          )}
        </div>
      </PeekSheet>
    </motion.div>
  )
}
