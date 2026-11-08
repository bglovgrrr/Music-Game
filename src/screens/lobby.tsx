import { Play, Settings2, Share2, Speaker } from 'lucide-react'
import { toast } from 'sonner'
import { GameSettings } from '@/components/game-settings'
import { LabelTape } from '@/components/physical'
import { QrCode } from '@/components/qr-code'
import { MusicSetup } from '@/components/music-setup'
import { useMusicReady } from '@/hooks/use-music-ready'
import { PeekSheet } from '@/components/sheet'
import { StickerBoard } from '@/components/sticker-board'
import { spotifyConfigured } from '@/music/spotify-auth'
import { Button } from '@/components/ui/button'
import { MIN_PLAYERS, settingsOf } from '@/game/engine'
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

  const settings = settingsOf(state)
  const music = useMusicReady()
  // The phone that plays the music sets it up here. In an online game it's required to start.
  const showMusic = client.isSpeaker && spotifyConfigured
  const needsMusic = showMusic && client.mode === 'online'
  const settingsSummary = [settings.guessMode ? 'Guessing on' : 'Guessing off', settings.pickSeconds ? `${settings.pickSeconds}s timer` : 'No timer'].join(
    ' · ',
  )

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 pt-1 pb-24 short:gap-3 short:pb-[4.5rem]">
      {/* Goal: get everyone in. Code + QR up top, stickers in the middle, Start at the thumb. */}
      <div className="flex items-center gap-4">
        <QrCode value={inviteUrl} className="w-[6.5rem] shrink-0 short:hidden" />
        <div className="grid min-w-0 justify-items-start gap-2">
          <span className="font-mono text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">Room code</span>
          <button onClick={copy} className="cursor-pointer" aria-label={`Copy room code ${state.code}`}>
            <LabelTape className="py-1.5 text-4xl">{state.code}</LabelTape>
          </button>
          <span className="text-xs leading-snug text-muted-foreground">
            Scan to join{client.mode === 'demo' ? ' (not in the demo)' : ''}, or tap the code to copy it.
          </span>
          {client.mode === 'online' && (
            <Button variant="outline" size="sm" onClick={invite}>
              <Share2 /> Invite link
            </Button>
          )}
        </div>
      </div>

      <section>
        <div className="flex items-baseline justify-between pb-3">
          <h2 className="text-xl leading-none font-bold font-soft">Who&rsquo;s here</h2>
          <span className="font-mono text-xs tracking-[0.1em] text-muted-foreground">{state.players.length}/8</span>
        </div>
        <StickerBoard players={state.players} meId={meId} hostId={state.hostId} outlines={4} />
      </section>

      <div className="mt-auto grid gap-2">
        {/* The host can't start until the music is set up: Spotify ready, or previews on purpose */}
        {showMusic && <MusicSetup music={music} />}
        {client.mode === 'online' && host && !(needsMusic && !music.ready) && (
          <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <Speaker className="size-3.5 shrink-0" />
            {isHost ? 'Music plays from your phone. Connect it to a speaker.' : `Music plays from ${host.name}'s phone.`}
          </p>
        )}
        {isHost ? (
          <Button variant="brand" size="lg" disabled={!enough || (needsMusic && !music.ready)} onClick={() => dispatch({ type: 'start' })}>
            <Play />{' '}
            {!enough
              ? `Need ${MIN_PLAYERS - state.players.length} more`
              : needsMusic && !music.ready
                ? 'Set up the music to start'
                : `Start with ${state.players.length} players`}
          </Button>
        ) : (
          <p className="text-center text-muted-foreground">Waiting for the host to start…</p>
        )}
      </div>

      <PeekSheet label="Game settings" summary={settingsSummary} icon={<Settings2 />}>
        <div className="grid gap-5 pt-1">
          <GameSettings />
        </div>
      </PeekSheet>
    </div>
  )
}
