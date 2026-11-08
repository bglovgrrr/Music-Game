import { Check, Eye } from 'lucide-react'
import { PlayerAvatar } from '@/components/game-ui'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { currentRound, guessersFor, playerById } from '@/game/engine'
import { useGame } from '@/hooks/use-game'
import { cn } from '@/lib/utils'

export function GuessPanel() {
  const { state, dispatch, meId } = useGame()
  const round = currentRound(state)!
  const owner = round.order[round.current]
  const guesses = round.guesses?.[owner] ?? {}
  const guessers = guessersFor(state, owner)
  const done = guessers.filter((p) => guesses[p.id]).length
  const mine = guesses[meId]
  const options = round.order
    .filter((id) => id !== meId)
    .map((id) => playerById(state, id)!)
    .filter(Boolean)

  return (
    <Card className="mx-auto grid w-full max-w-md gap-4 p-4">
      {owner === meId ? (
        <div className="text-center">
          <p className="font-display text-xl font-medium">🤫 This one's yours</p>
          <p className="text-sm text-muted-foreground">Keep a straight face while they guess.</p>
        </div>
      ) : (
        <>
          <p className="text-center font-display text-xl font-medium">Who picked this?</p>
          <div className="flex flex-wrap justify-center gap-3">
            {options.map((p) => (
              <button
                key={p.id}
                onClick={() => dispatch({ type: 'guess', owner, guessed: p.id })}
                aria-pressed={mine === p.id}
                className={cn(
                  'grid cursor-pointer justify-items-center gap-1 rounded-2xl p-2 transition active:scale-95',
                  mine === p.id ? 'bg-secondary' : 'hover:bg-muted',
                )}
              >
                <PlayerAvatar player={p} size="lg" ring={mine === p.id} />
                <span className="max-w-16 truncate text-xs font-medium">{p.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <span className="text-sm text-muted-foreground">
          {done}/{guessers.length} guesses in
        </span>
        <Button variant="secondary" size="sm" onClick={() => dispatch({ type: 'reveal', owner })}>
          <Eye /> Reveal
        </Button>
      </div>
    </Card>
  )
}

/** After the reveal: who got it right. */
export function GuessResult() {
  const { state, meId } = useGame()
  const round = currentRound(state)!
  const owner = round.order[round.current]
  const guesses = round.guesses?.[owner] ?? {}
  const right = Object.entries(guesses)
    .filter(([, g]) => g === owner)
    .map(([id]) => playerById(state, id))
    .filter(Boolean)
  if (!Object.keys(guesses).length) return null
  return (
    <p className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
      {right.length ? (
        <>
          <Check className="size-4 text-success" /> Guessed right:
          {right.map((p) => (
            <span key={p!.id} className="font-semibold text-foreground">
              {p!.id === meId ? 'you' : p!.name}
            </span>
          ))}
        </>
      ) : (
        'Nobody guessed it! 😮'
      )}
    </p>
  )
}
