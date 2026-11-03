import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { AvatarStack, Logo } from '@/components/game-ui'
import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useGame } from '@/hooks/use-game'

export function GameShell({ children, onExit }: { children: React.ReactNode; onExit: () => void }) {
  const { state, client, isHost, dispatch } = useGame()
  const [confirming, setConfirming] = useState(false)
  const round = state.rounds.length
  const inGame = state.phase !== 'lobby' && state.phase !== 'recap'

  const handleExit = () => {
    if (!confirming) {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 3000)
      return
    }
    if (inGame && isHost) dispatch({ type: 'end' })
    else onExit()
    setConfirming(false)
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pt-safe pb-safe sm:px-8">
      <header className="sticky top-0 z-20 -mx-4 mb-3 flex h-16 items-center gap-2.5 bg-background/75 px-4 backdrop-blur-xl sm:-mx-8 sm:px-8">
        <Logo className="max-sm:[&>span:last-child]:hidden" />
        <Badge variant="outline" className="h-7 bg-card px-3 font-mono text-[0.8rem] tracking-[0.18em] text-foreground">
          {state.code}
        </Badge>
        {client.mode === 'demo' && <Badge variant="secondary" className="max-sm:hidden">Demo</Badge>}
        {round > 0 && state.phase !== 'recap' && <span className="text-sm text-muted-foreground max-sm:hidden">Round {round}</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <AvatarStack players={state.players} />
          <ThemeToggle />
          {state.phase !== 'recap' && (
            <Button variant={confirming ? 'destructive' : 'ghost'} size="sm" onClick={handleExit} aria-label="Leave game">
              <LogOut />
              {confirming ? (inGame && isHost ? 'End game?' : 'Leave?') : <span className="max-sm:hidden">{inGame && isHost ? 'End' : 'Leave'}</span>}
            </Button>
          )}
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
