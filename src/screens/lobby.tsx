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
import { MAX_PLAYERS, MIN_PLAYERS } from '@/game/engine'
import type { Player } from '@/game/types'
import { cn } from '@/lib/utils'
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
        <Card className="px-4 pt-4 pb-3">
          <div className="flex items-baseline justify-between pb-3">
            <h3 className="text-xl leading-none font-bold font-soft">Who&rsquo;s here</h3>
            <span className="font-mono text-xs tracking-[0.1em] text-muted-foreground">{state.players.length}/8</span>
          </div>
          <StickerSlots players={state.players} meId={meId} hostId={state.hostId} />
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

/**
 * Four dotted outlines per row; each player who joins slaps a sticker into the next one.
 * Always shows at least 4 slots, and one free row while there's room (max 8 players).
 */
function StickerSlots({ players, meId, hostId }: { players: Player[]; meId: string; hostId: string }) {
  const n = players.length
  const slots = Math.min(MAX_PLAYERS, Math.max(4, Math.ceil(Math.min(n + 1, MAX_PLAYERS) / 4) * 4))
  return (
    <ul className="grid grid-cols-4 gap-x-3 gap-y-4">
      {Array.from({ length: slots }, (_, i) => {
        const p = players[i]
        return (
          <li key={p?.id ?? `empty-${i}`} className="grid justify-items-center gap-1.5">
            <div className="relative grid aspect-square w-full place-items-center rounded-[22%] border-2 border-dashed border-[#2a1e18]/40">
              <AnimatePresence>
                {p && (
                  <motion.div
                    key={p.id}
                    initial={{ scale: 1.7, opacity: 0, y: -24, rotate: -25 }}
                    animate={{ scale: 1, opacity: 1, y: 0, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 17 }}
                    className="absolute inset-[-6%]"
                  >
                    <PlayerAvatar player={p} className="size-full" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span className={cn('max-w-full truncate text-center text-xs font-semibold', !p && 'text-transparent')}>
              {p ? (p.id === meId ? 'You' : p.name) : '·'}
            </span>
            {p && p.id === hostId && <span className="-mt-1.5 font-mono text-[0.6rem] tracking-[0.12em] text-muted-foreground uppercase">Host</span>}
          </li>
        )
      })}
    </ul>
  )
}
