import { Check, Loader2, Music2, Smartphone } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useSpotifyConnected } from '@/hooks/use-spotify'
import { connectSpotify } from '@/music/spotify-auth'
import { isIOS, localPlayerUsable, onPhoneSpotify, phoneSpotify, wakeSpotify } from '@/music/spotify-player'
import { cn, safeStorage } from '@/lib/utils'

const PREVIEWS_KEY = 'sideb:music-previews'

/**
 * The host's music, set up before the game can start. Ready means either:
 *  - Spotify is connected and can play here (on an iPhone: the Spotify app is open), or
 *  - the host chose 30-second previews on purpose.
 */
export function useMusicReady() {
  const connected = useSpotifyConnected()
  const phone = useSyncExternalStore(onPhoneSpotify, phoneSpotify, phoneSpotify)
  const [previews, setPreviewsState] = useState(() => safeStorage.get(PREVIEWS_KEY) === '1')
  const setPreviews = (v: boolean) => {
    safeStorage.set(PREVIEWS_KEY, v ? '1' : '')
    setPreviewsState(v)
  }
  const needsPhoneApp = isIOS() && !localPlayerUsable()
  const spotifyReady = connected && (!needsPhoneApp || phone === 'awake')
  return { connected, phone, needsPhoneApp, previews: previews && !connected, ready: spotifyReady || (previews && !connected), setPreviews }
}

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

  if (previews) {
    return (
      <div className="paper paper-texture on-table grid gap-1 rounded-[4px] bg-[var(--paper)] px-3.5 py-3">
        <Step done label="Music: 30-second previews" hint="Songs play a short clip from this phone." />
        <button className="cursor-pointer justify-self-start pl-8 text-sm font-semibold text-[#a0560b] underline-offset-2 hover:underline" onClick={() => setPreviews(false)}>
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
        <span className={cn('ml-auto font-mono text-[0.6rem] tracking-[0.14em] uppercase', ready ? 'text-success' : 'text-muted-foreground')}>{ready ? 'Ready' : 'Required'}</span>
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

function Step({ done, disabled, icon, label, hint, action }: { done?: boolean; disabled?: boolean; icon?: React.ReactNode; label: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className={cn('flex items-center gap-2.5', disabled && 'opacity-45')}>
      <span className={cn('grid size-5.5 shrink-0 place-items-center rounded-full border-2', done ? 'border-success bg-success text-[#fffdf8]' : 'border-[#2a1e18]/30 text-[#2a1e18]/50')}>
        {done ? <Check className="size-3" strokeWidth={3} /> : icon}
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="text-sm font-semibold">{label}</span>
        {hint && <span className="text-xs leading-snug text-muted-foreground [@media(max-height:700px)]:hidden">{hint}</span>}
      </span>
      {action}
    </div>
  )
}
