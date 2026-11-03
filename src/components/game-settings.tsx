import { Timer, UserRoundSearch } from 'lucide-react'
import { Segmented, Switch } from '@/components/ui/controls'
import { PICK_TIMER_OPTIONS, settingsOf } from '@/game/engine'
import { useGame } from '@/hooks/use-game'
import { cn } from '@/lib/utils'

/** Game options. The host can change them; everyone else sees them. */
export function GameSettings({ className }: { className?: string }) {
  const { state, dispatch, isHost } = useGame()
  const settings = settingsOf(state)
  const timerOptions = [{ value: null, label: 'Off' }, ...PICK_TIMER_OPTIONS.map((s) => ({ value: s, label: s < 120 ? `${s}s` : `${s / 60} min` }))]

  return (
    <div className={cn('grid gap-4', className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--pastel-1)] text-ink">
          <UserRoundSearch className="size-4" />
        </span>
        <label htmlFor="setting-guess" className="grid flex-1 gap-0.5">
          <span className="text-sm font-semibold">Guess who picked it</span>
          <span className="text-xs text-muted-foreground">Everyone guesses whose song it is before the reveal. 1 point per correct guess.</span>
        </label>
        <Switch
          id="setting-guess"
          label="Guess who picked it"
          checked={settings.guessMode}
          disabled={!isHost}
          onChange={(guessMode) => dispatch({ type: 'settings', settings: { guessMode } })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--pastel-3)] text-ink">
          <Timer className="size-4" />
        </span>
        <span className="grid flex-1 gap-0.5">
          <span className="text-sm font-semibold">Pick timer</span>
          <span className="text-xs text-muted-foreground">Keeps the game moving. Listening starts when time's up.</span>
        </span>
        <Segmented
          label="Pick timer"
          value={settings.pickSeconds}
          options={timerOptions}
          disabled={!isHost}
          onChange={(pickSeconds) => dispatch({ type: 'settings', settings: { pickSeconds } })}
        />
      </div>
      {!isHost && <p className="text-xs text-muted-foreground">Only the host can change these.</p>}
    </div>
  )
}
