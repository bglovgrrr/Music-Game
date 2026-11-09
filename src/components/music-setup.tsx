import { Check, Loader2, Music2, Smartphone, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { SpotifyCard, SpotifyLogo } from '@/components/spotify-card'
import { Button } from '@/components/ui/button'
import { connectSpotify } from '@/music/spotify-auth'
import type { useMusicReady } from '@/hooks/use-music-ready'
import { wakeSpotify } from '@/music/spotify-session'
import { cn } from '@/lib/utils'

export function MusicSetup({ music }: { music: ReturnType<typeof useMusicReady> }) {
  const [busy, setBusy] = useState(false)
  const { connected, phone, needsPhoneApp, previews, ready, setPreviews } = music

  const connect = async () => {
    setBusy(true)
    try {
      await connectSpotify()
      setPreviews(false)
    } catch (err) {
      toast.error((err as Error).message || 'Could not connect Spotify')
    } finally {
      setBusy(false)
    }
  }

  // Ready with Spotify: one compact row; the full Spotify panel opens on demand.
  if (connected && ready) return <SpotifyReadyRow />

  if (previews) {
    return (
      <div className="paper paper-texture on-table grid gap-1 rounded-[4px] bg-[var(--paper)] px-3.5 py-3">
        <Step done label="Music: 30-second previews" hint="Songs play a short clip from this phone." />
        <button
          className="cursor-pointer justify-self-start pl-8 text-sm font-semibold text-[#a0560b] underline-offset-2 hover:underline"
          onClick={() => setPreviews(false)}
        >
          Use Spotify for full songs instead
        </button>
      </div>
    )
  }

  return (
    <div className="paper paper-texture on-table grid gap-2 rounded-[4px] bg-[var(--paper)] px-3.5 py-3">
      <div className="flex items-center gap-2">
        <Music2 className="size-4 text-[#a0560b]" />
        <span className="font-display text-base leading-none font-bold [font-stretch:80%]">Set up the music</span>
        <span className={cn('ml-auto font-mono text-[0.6rem] tracking-[0.14em] uppercase', ready ? 'text-success' : 'text-muted-foreground')}>
          {ready ? 'Ready' : 'Required'}
        </span>
      </div>
      <Step
        done={connected}
        label="Connect Spotify"
        hint="Needs Spotify Premium. Full songs play from here."
        action={
          !connected && (
            <Button variant="sketch-fill" size="sm" onClick={connect} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null} Connect
            </Button>
          )
        }
      />
      {needsPhoneApp && (
        <Step
          done={connected && phone === 'awake'}
          disabled={!connected}
          icon={<Smartphone className="size-3.5" />}
          label="Open Spotify on this phone"
          hint={connected && phone === 'unknown' ? 'Checking…' : 'Open it once, then come right back. We keep it awake after that.'}
          action={
            connected &&
            phone !== 'awake' && (
              <Button variant="sketch-fill" size="sm" onClick={wakeSpotify}>
                Open
              </Button>
            )
          }
        />
      )}
      {!connected && (
        <button className="cursor-pointer justify-self-start pl-8 text-xs text-muted-foreground underline underline-offset-2" onClick={() => setPreviews(true)}>
          No Spotify Premium? Play 30-second previews instead
        </button>
      )}
    </div>
  )
}

function Step({
  done,
  disabled,
  icon,
  label,
  hint,
  action,
}: {
  done?: boolean
  disabled?: boolean
  icon?: React.ReactNode
  label: string
  hint?: string
  action?: React.ReactNode
}) {
  return (
    <div className={cn('flex items-center gap-2.5', disabled && 'opacity-45')}>
      <span
        className={cn(
          'grid size-5.5 shrink-0 place-items-center rounded-full border-2',
          done ? 'border-success bg-success text-[#fffdf8]' : 'border-[#2a1e18]/30 text-[#2a1e18]/50',
        )}
      >
        {done ? <Check className="size-3" strokeWidth={3} /> : icon}
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="text-sm font-semibold">{label}</span>
        {hint && <span className="text-xs leading-snug text-muted-foreground short:hidden">{hint}</span>}
      </span>
      {action}
    </div>
  )
}

/** "Spotify ready" with a Manage button that opens the full Spotify panel. */
function SpotifyReadyRow() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="paper paper-texture on-table flex items-center gap-3 rounded-[4px] bg-[var(--paper)] px-3.5 py-2.5">
        <SpotifyLogo className="size-7 shrink-0" />
        <span className="grid min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <Check className="size-3.5 text-success" strokeWidth={3} /> Spotify ready
          </span>
          <span className="truncate text-xs text-muted-foreground">Full songs play from this phone.</span>
        </span>
        <Button variant="sketch" size="sm" onClick={() => setOpen(true)}>
          Manage
        </Button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-3 sm:place-items-center"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Spotify"
          >
            <motion.div
              initial={{ y: 30 }}
              animate={{ y: 0 }}
              exit={{ y: 30 }}
              className="paper paper-texture grid max-h-[85dvh] w-full max-w-md gap-3 overflow-y-auto rounded-[4px] bg-[var(--paper)] p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold font-soft">Spotify</h3>
                <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close">
                  <X />
                </Button>
              </div>
              <SpotifyCard />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
