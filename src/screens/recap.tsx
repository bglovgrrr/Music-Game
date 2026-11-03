import { Copy, ExternalLink, Home, ImageIcon, ListMusic, Loader2, Share, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CrownedName, PlayerAvatar, TrackRow } from '@/components/game-ui'
import { Scoreboard } from '@/components/scoreboard'
import { Polaroid, SelfieCard } from '@/components/selfie'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { playerById, voteResults } from '@/game/engine'
import { drawRecapCard } from '@/lib/recap-card'
import { saveToSpotify, spotifyAvailable, type ExportResult } from '@/music/spotify'
import { useGame } from '@/hooks/use-game'
import { cn } from '@/lib/utils'

/** Shows the recap image with Share (where supported) or "press and hold to save". */
function RecapCardDialog({ onClose }: { onClose: () => void }) {
  const { state, client } = useGame()
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let objectUrl: string | null = null
    const latest = [...state.rounds].reverse().find((r) => r.photo)?.photo
    ;(latest ? client.photoUrl(latest.path).catch(() => null) : Promise.resolve(null))
      .then((photoUrl) => drawRecapCard(state, photoUrl))
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        setFile(new File([blob], 'side-b-mixtape.png', { type: 'image/png' }))
        setUrl(objectUrl)
      })
      .catch(() => toast.error('Could not make the image'))
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [state, client])

  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  const share = async () => {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: 'Our Side B mixtape' })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast.error('Could not share')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Recap card"
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        className="grid w-full max-w-sm gap-3 rounded-3xl bg-card p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium font-soft">Your recap card</h3>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        <div className="grid aspect-[4/5] place-items-center overflow-hidden rounded-2xl bg-muted">
          {url ? <img src={url} alt="Recap card of tonight's mixtape" className="size-full object-cover" /> : <Loader2 className="size-6 animate-spin text-muted-foreground" />}
        </div>
        {canShare ? (
          <Button variant="brand" size="lg" onClick={share}>
            <Share /> Share
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">Press and hold the image to save or share it.</p>
        )}
      </motion.div>
    </motion.div>
  )
}

/** "Save to Spotify" with progress, the playlist link, and clear errors. */
function SpotifyButton() {
  const { state } = useGame()
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<ExportResult | null>(null)

  if (!spotifyAvailable) {
    return (
      <Button variant="outline" disabled>
        <ListMusic /> Save to Spotify <Badge variant="secondary">Soon</Badge>
      </Button>
    )
  }
  if (result) {
    return (
      <Button variant="outline" asChild>
        <a href={result.url} target="_blank" rel="noreferrer">
          <ExternalLink /> Open playlist ({result.added} songs)
        </a>
      </Button>
    )
  }

  const save = async () => {
    const tracks = state.rounds.flatMap((r) => r.order.map((pid) => r.picks.find((p) => p.playerId === pid)!.track))
    const date = new Date(state.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const prompts = state.rounds.filter((r) => r.order.length).map((r) => r.prompt)
    try {
      const res = await saveToSpotify(`Side B · ${date}`, `Our Side B mixtape: ${prompts.join(' / ')}`.slice(0, 300), tracks, setBusy)
      setResult(res)
      toast.success('Playlist saved to Spotify', {
        description: res.missing.length ? `${res.missing.length} song${res.missing.length > 1 ? 's' : ''} couldn't be found on Spotify.` : undefined,
      })
    } catch (err) {
      toast.error((err as Error).message || 'Could not save to Spotify')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Button variant="outline" onClick={save} disabled={!!busy}>
      {busy ? <Loader2 className="animate-spin" /> : <ListMusic />} {busy ?? 'Save to Spotify'}
    </Button>
  )
}

export function RecapScreen({ onExit }: { onExit: () => void }) {
  const { state } = useGame()
  const [showCard, setShowCard] = useState(false)
  const rounds = state.rounds.filter((r) => r.order.length > 0)
  const songs = rounds.reduce((n, r) => n + r.order.length, 0)
  const photos = state.rounds.filter((r) => r.photo)
  const lastRound = rounds[rounds.length - 1]

  const copyList = async () => {
    const text = rounds
      .map((r) => {
        const lines = r.order.map((pid) => {
          const p = r.picks.find((x) => x.playerId === pid)!
          return `  • ${p.track.title} — ${p.track.artist} (${playerById(state, pid)?.name ?? '?'})`
        })
        return `“${r.prompt}”\n${lines.join('\n')}`
      })
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(`Side B — game ${state.code}\n\n${text}`)
      toast.success('Song list copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto grid w-full max-w-2xl gap-6 py-6">
      <div className="text-center">
        <h2 className="text-5xl font-medium font-soft">
          That's a <em className="brand-text pr-1">wrap.</em>
        </h2>
        <p className="mt-2 text-muted-foreground">
          {rounds.length} {rounds.length === 1 ? 'question' : 'questions'} · {songs} songs · {state.players.length} friends
        </p>
      </div>

      <div className="grid gap-3">
        <Button variant="brand" size="lg" onClick={() => setShowCard(true)} disabled={!songs}>
          <ImageIcon /> Share recap card
        </Button>
        <div className="grid gap-3 sm:grid-cols-2">
          <SpotifyButton />
          <Button variant="outline" onClick={copyList} disabled={!songs}>
            <Copy /> Copy song list
          </Button>
        </div>
      </div>

      <Card className="p-3 empty:hidden">
        <Scoreboard />
      </Card>

      {photos.length > 0 ? (
        <section className="grid gap-3">
          <h3 className="px-1 text-lg font-medium font-soft">Photos</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 px-1 py-2 sm:grid-cols-3">
            {photos.map((r, i) => (
              <Polaroid key={r.id} photo={r.photo!} caption={r.prompt} tilt={i % 2 ? 2.5 : -2.5} />
            ))}
          </div>
        </section>
      ) : (
        lastRound && (
          <Card className="p-4">
            <SelfieCard round={lastRound} />
          </Card>
        )
      )}

      <AnimatePresence>{showCard && <RecapCardDialog onClose={() => setShowCard(false)} />}</AnimatePresence>

      {rounds.map((r) => (
        <Card key={r.id} className="p-3">
          <div className="flex items-start gap-3 px-2 pt-1 pb-3">
            {playerById(state, r.askerId) && <PlayerAvatar player={playerById(state, r.askerId)!} size="sm" />}
            <p className="font-display text-lg leading-snug italic">{r.prompt}</p>
          </div>
          {r.order.map((pid) => {
            const p = r.picks.find((x) => x.playerId === pid)!
            const who = playerById(state, pid)
            const crowned = voteResults(r).winners.includes(pid)
            return (
              <TrackRow
                key={pid}
                track={p.track}
                right={
                  <CrownedName name={who?.name ?? ''} crowned={crowned} className={cn('pt-1 text-sm', crowned ? 'font-semibold text-foreground' : 'text-muted-foreground')} />
                }
              />
            )
          })}
        </Card>
      ))}

      <Button variant="brand" size="lg" onClick={onExit}>
        <Home /> Back to start
      </Button>
    </motion.div>
  )
}
