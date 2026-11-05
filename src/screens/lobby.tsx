import { Copy, Play, Share2, Speaker } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { GameSettings } from '@/components/game-settings'
import { PlayerAvatar } from '@/components/game-ui'
import { LabelTape } from '@/components/physical'
import { QrCode } from '@/components/qr-code'
import { SpotifyCard } from '@/components/spotify-card'
import { spotifyConfigured } from '@/music/spotify-auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MIN_PLAYERS } from '@/game/engine'
import { useGame } from '@/hooks/use-game'

export function LobbyScreen() {
  const { state, dispatch, isHost, meId, client } = useGame()
  const enough = state.players.length >= MIN_PLAYERS
  const host = state.players.find((p) => p.id === state.hostId)
  const inviteUrl = `${window.location.origin}${window.location.pathname}?join=${state.code}`

  const invite = async () => {
    const text = `Join my Mixtape Memories game! Code: ${state.code}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Mixtape Memories', text, url: inviteUrl })
        return
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${inviteUrl}`)
      toast.success('Invite link copied')
    } catch {
      toast(inviteUrl)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.code)
      toast.success('Room code copied')
    } catch {
      toast(state.code)
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl flex-1 content-center gap-6 py-6 md:grid-cols-2 md:gap-10">
      <div className="grid content-start justify-items-center gap-4 text-center">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Room code</p>
          <button onClick={copy} className="group mt-1 inline-flex cursor-pointer items-center gap-3" aria-label={`Copy room code ${state.code}`}>
            <LabelTape className="py-2 text-5xl">{state.code}</LabelTape>
            <Copy className="size-5 text-muted-foreground transition group-hover:text-foreground" />
          </button>
        </div>
        <QrCode value={inviteUrl} className="w-44 md:w-52" />
        <p className="text-sm text-muted-foreground">
          Scan with a phone camera to join{client.mode === 'demo' ? ' (not in the demo)' : ''}, or enter the code.
        </p>
        {client.mode === 'online' && (
          <Button variant="outline" size="sm" onClick={invite}>
            <Share2 /> Send invite link
          </Button>
        )}
      </div>

      <div className="grid content-start gap-4">
        <Card className="p-2">
          <ul>
            <AnimatePresence initial={false}>
              {state.players.map((p) => (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="flex items-center gap-3 rounded-xl p-2"
                >
                  <PlayerAvatar player={p} />
                  <span className="font-semibold">{p.name}</span>
                  {p.id === meId && <span className="text-sm text-muted-foreground">(you)</span>}
                  {p.id === state.hostId && <span className="ml-auto text-xs font-medium text-muted-foreground">Host</span>}
                </motion.li>
              ))}
            </AnimatePresence>
            <li className="flex items-center gap-3 rounded-xl p-2 text-muted-foreground">
              <span className="grid size-10 place-items-center rounded-full border-2 border-dashed">
                <span className="size-2 animate-pulse rounded-full bg-muted-foreground" />
              </span>
              Waiting for friends…
            </li>
          </ul>
        </Card>

        <Card className="p-4">
          <GameSettings />
        </Card>

        {client.isSpeaker && spotifyConfigured && (
          <Card className="p-4">
            <SpotifyCard />
          </Card>
        )}

        {client.mode === 'online' && host && (
          <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Speaker className="size-4 shrink-0" />
            {isHost ? 'Music plays from your device. Connect it to a speaker.' : `Music plays from ${host.name}'s device.`}
          </p>
        )}

        {isHost ? (
          <Button variant="brand" size="lg" disabled={!enough} onClick={() => dispatch({ type: 'start' })}>
            <Play /> {enough ? `Start with ${state.players.length} players` : `Need ${MIN_PLAYERS - state.players.length} more`}
          </Button>
        ) : (
          <p className="text-center text-muted-foreground">Waiting for the host to start…</p>
        )}
      </div>
    </div>
  )
}
