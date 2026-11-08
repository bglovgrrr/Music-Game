import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { AvatarStack } from '@/components/game-ui'
import { LabelTape } from '@/components/physical'
import { VersionTag } from '@/components/version-tag'
import { SpotifyWakeBanner } from '@/components/spotify-wake-banner'
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
    <div className="mx-auto flex h-dvh w-full max-w-5xl flex-col px-4 pt-safe sm:px-8">
      <header className="relative z-20 -mx-4 mb-2 flex h-14 shrink-0 items-center gap-2.5 bg-[color-mix(in_oklab,var(--table)_70%,black_20%)]/80 px-4 backdrop-blur-md shadow-[0_8px_20px_-14px_rgb(0_0_0/0.8)] sm:-mx-8 sm:px-8">
        <h1 className="sr-only">Mixtape Memories, room {state.code}</h1>
        <LabelTape className="text-[0.8rem]">{state.code}</LabelTape>
        <VersionTag className="max-[370px]:hidden" />
        {client.mode === 'demo' && (
          <Badge variant="secondary" className="max-sm:hidden">
            Demo
          </Badge>
        )}
        {round > 0 && state.phase !== 'recap' && (
          <span className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase max-sm:hidden">Round {String(round).padStart(2, '0')}</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <AvatarStack players={state.players} />
          <ThemeToggle />
          {state.phase !== 'recap' && (
            <Button variant={confirming ? 'destructive' : 'ghost'} size="sm" onClick={handleExit} aria-label="Leave game">
              <LogOut />
              {confirming ? inGame && isHost ? 'End game?' : 'Leave?' : <span className="max-sm:hidden">{inGame && isHost ? 'End' : 'Leave'}</span>}
            </Button>
          )}
        </div>
      </header>
      <SpotifyWakeBanner />
      <main className="no-scrollbar -mx-4 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-[env(safe-area-inset-bottom)] sm:-mx-8 sm:px-8">
        {children}
      </main>
    </div>
  )
}
