import { Copy, Home, ImageIcon, Trophy } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { FanFavoriteBanner, Scoreboard } from '@/components/scoreboard'
import { Polaroid, SelfieCard } from '@/components/selfie'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { playerById } from '@/game/engine'
import { PeekSheet } from '@/components/sheet'
import { useGame } from '@/hooks/use-game'
import { RecapCardDialog } from '@/components/recap/share-card-dialog'
import { RoundCarousel } from '@/components/recap/round-carousel'
import { SpotifyButton } from '@/components/recap/spotify-button'

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
      await navigator.clipboard.writeText(`Mixtape Memories — game ${state.code}\n\n${text}`)
      toast.success('Song list copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-3 pt-1 pb-24">
      {/* Goal: relive the night and share it. Swipe through the rounds; scores and photos in the sheet. */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-4xl leading-none font-bold font-soft">
            That's a <em className="brand-text pr-1">wrap.</em>
          </h2>
          <p className="mt-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
            {rounds.length} {rounds.length === 1 ? 'question' : 'questions'} · {songs} songs · {state.players.length} friends
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onExit} aria-label="Back to start">
          <Home />
        </Button>
      </div>

      <FanFavoriteBanner className="py-2" />

      <RoundCarousel rounds={rounds} />

      <div className="grid gap-2">
        <Button variant="brand" size="lg" onClick={() => setShowCard(true)} disabled={!songs}>
          <ImageIcon /> Share recap card
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <SpotifyButton />
          <Button variant="outline" onClick={copyList} disabled={!songs}>
            <Copy /> Copy list
          </Button>
        </div>
      </div>

      <AnimatePresence>{showCard && <RecapCardDialog onClose={() => setShowCard(false)} />}</AnimatePresence>

      <PeekSheet
        label="Scores & photos"
        summary={photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''}` : 'Add a group selfie'}
        icon={<Trophy />}
      >
        <div className="grid gap-4 pt-1">
          <Card className="p-3 empty:hidden">
            <Scoreboard />
          </Card>
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 px-1 py-2">
              {photos.map((r, i) => (
                <Polaroid key={r.id} photo={r.photo!} caption={r.prompt} tilt={i % 2 ? 2.5 : -2.5} />
              ))}
            </div>
          ) : (
            lastRound && (
              <Card className="p-4">
                <SelfieCard round={lastRound} />
              </Card>
            )
          )}
        </div>
      </PeekSheet>
    </motion.div>
  )
}
