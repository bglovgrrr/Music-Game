import { Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AudioEngine, unlockAudio } from '@/components/audio-engine'
import { ReactionLayer } from '@/components/reactions'
import { SpotifyKeepAlive } from '@/components/spotify-keepalive'
import { spotifyConfigured } from '@/music/spotify-auth'
import { Toaster } from '@/components/ui/sonner'
import type { GameClient } from '@/game/client'
import { LocalGameClient } from '@/game/local-client'
import { OnlineGameClient } from '@/game/online-client'
import { useCues } from '@/hooks/use-cues'
import { GameContext, useGame } from '@/hooks/use-game'
import { unlockChime } from '@/lib/chime'
import { useWakeLock } from '@/hooks/use-wake-lock'
import { activateLocalPlayer } from '@/music/spotify-sdk'
import { setDemoActive } from '@/lib/pwa'
import { onlineAvailable } from '@/lib/supabase'
import { AskingScreen } from '@/screens/asking'
import { BetweenScreen } from '@/screens/between'
import { GameShell } from '@/screens/game-shell'
import { HomeScreen } from '@/screens/home'
import { ListeningScreen } from '@/screens/listening'
import { LobbyScreen } from '@/screens/lobby'
import { PickingScreen } from '@/screens/picking'
import { RecapScreen } from '@/screens/recap'

function Game({ onExit }: { onExit: () => void }) {
  const { state, client, meId } = useGame()
  useCues(state, meId)
  useWakeLock(client.isSpeaker && state.phase !== 'lobby' && state.phase !== 'recap')
  const screens = {
    lobby: <LobbyScreen />,
    asking: <AskingScreen />,
    picking: <PickingScreen />,
    listening: <ListeningScreen />,
    between: <BetweenScreen />,
    recap: <RecapScreen onExit={onExit} />,
  }
  return (
    <GameShell onExit={onExit}>
      {client.isSpeaker && state.phase === 'listening' && <AudioEngine />}
      <ReactionLayer />
      {client.isSpeaker && spotifyConfigured && <SpotifyKeepAlive />}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${state.phase}-${state.rounds.length}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="flex flex-1 flex-col"
        >
          {screens[state.phase]}
        </motion.div>
      </AnimatePresence>
    </GameShell>
  )
}

export default function App() {
  const [client, setClient] = useState<GameClient | null>(null)
  const [resuming, setResuming] = useState(onlineAvailable)

  // Reopen the game this device was in (refresh, phone locked, app reopened).
  useEffect(() => {
    if (!onlineAvailable) return
    OnlineGameClient.resume()
      .then((c) => c && setClient(c))
      .catch(() => OnlineGameClient.forget())
      .finally(() => setResuming(false))
  }, [])

  // Let this device play sound later, even when someone else presses play.
  useEffect(() => {
    const unlock = () => {
      unlockAudio()
      unlockChime()
      activateLocalPlayer()
    }
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
    setDemoActive(client?.mode === 'demo')
  }, [client])

  const exit = () => {
    if (client?.mode === 'online') {
      const s = client.getState()
      // Leaving a lobby frees your seat; mid-game you stay in the recap.
      if (s.phase === 'lobby') {
        try {
          client.dispatch({ type: 'leave', playerId: client.meId })
        } catch {
          /* ignore */
        }
      }
      OnlineGameClient.forget()
    }
    client?.dispose()
    setClient(null)
  }

  const go = async (make: () => Promise<GameClient>) => {
    try {
      setClient(await make())
    } catch (err) {
      toast.error((err as Error).message || 'Something went wrong')
    }
  }

  return (
    <>
      <div className="app-backdrop" />
      {resuming ? (
        <div className="grid min-h-dvh place-items-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : client ? (
        <GameContext.Provider value={client}>
          <Game onExit={exit} />
        </GameContext.Provider>
      ) : (
        <HomeScreen
          onDemo={(name) => setClient(new LocalGameClient(name))}
          onCreate={(name) => go(() => OnlineGameClient.create(name))}
          onJoin={(code, name) => go(() => OnlineGameClient.join(code, name))}
        />
      )}
      <Toaster />
    </>
  )
}
