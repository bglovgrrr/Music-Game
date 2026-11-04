import { Check, Loader2, RefreshCw, Speaker } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useSpotifyConnected } from '@/hooks/use-spotify'
import { connectSpotify, disconnectSpotify, SpotifyError, spotifyConfigured } from '@/music/spotify-auth'
import { chooseDevice, chosenDeviceId, listDevices, type SpotifyDevice } from '@/music/spotify-player'
import { cn } from '@/lib/utils'

function SpotifyLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#1ED760" />
      <path
        d="M17.3 16.6a.75.75 0 0 1-1 .25c-2.8-1.7-6.3-2.1-10.4-1.2a.75.75 0 1 1-.33-1.46c4.5-1 8.4-.56 11.5 1.36.36.22.47.69.25 1.05Zm1.3-3a.94.94 0 0 1-1.29.31c-3.2-2-8.1-2.55-11.9-1.4a.94.94 0 1 1-.55-1.8c4.3-1.3 9.7-.67 13.4 1.6.44.27.58.85.31 1.29Zm.12-3.1C14.9 8.2 8.6 8 5 9.1a1.13 1.13 0 1 1-.66-2.16c4.2-1.27 11.1-1.03 15.5 1.58a1.13 1.13 0 0 1-1.15 1.94Z"
        fill="#000"
      />
    </svg>
  )
}

/** Host: connect Spotify for full songs and pick where they play. */
export function SpotifyCard({ compact, className }: { compact?: boolean; className?: string }) {
  const connected = useSpotifyConnected()
  const [busy, setBusy] = useState(false)
  const [devices, setDevices] = useState<SpotifyDevice[] | null>(null)
  const [device, setDevice] = useState<string | null>(chosenDeviceId)
  const [loadingDevices, setLoadingDevices] = useState(false)

  const refresh = useCallback(async () => {
    setLoadingDevices(true)
    try {
      setDevices(await listDevices())
    } catch (err) {
      setDevices([])
      if (err instanceof SpotifyError) toast.error(err.message)
    } finally {
      setLoadingDevices(false)
    }
  }, [])

  useEffect(() => {
    if (connected) void refresh()
  }, [connected, refresh])

  if (!spotifyConfigured) return null

  const connect = async () => {
    setBusy(true)
    try {
      await connectSpotify()
      toast.success('Spotify connected. Songs will play in full.')
    } catch (err) {
      toast.error((err as Error).message || 'Could not connect Spotify')
    } finally {
      setBusy(false)
    }
  }

  const pick = (id: string) => {
    chooseDevice(id)
    setDevice(id)
  }

  if (!connected) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <SpotifyLogo className="size-9 shrink-0" />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="text-sm font-semibold">Play full songs with Spotify</span>
          <span className="text-xs text-muted-foreground">Needs Spotify Premium. Without it, songs play as 30-second previews.</span>
        </div>
        <Button size="sm" onClick={connect} disabled={busy} className="bg-[#1ED760] text-black hover:bg-[#1ED760]/90">
          {busy ? <Loader2 className="animate-spin" /> : null} Connect
        </Button>
      </div>
    )
  }

  const active = devices?.find((d) => d.id === device) ?? devices?.find((d) => d.is_active) ?? devices?.[0]
  if (compact) {
    return (
      <p className={cn('flex items-center justify-center gap-1.5 text-xs text-muted-foreground', className)}>
        <SpotifyLogo className="size-3.5" /> Full songs on Spotify{active ? ` · ${active.name}` : ''}
      </p>
    )
  }

  return (
    <div className={cn('grid gap-3', className)}>
      <div className="flex items-center gap-3">
        <SpotifyLogo className="size-9 shrink-0" />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            Spotify connected <Check className="size-4 text-success" />
          </span>
          <span className="text-xs text-muted-foreground">Songs play in full on the device below.</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => disconnectSpotify()}>
          Disconnect
        </Button>
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Speaker className="size-3.5" /> Play on
          </span>
          <Button variant="ghost" size="icon-sm" onClick={refresh} disabled={loadingDevices} aria-label="Refresh devices">
            <RefreshCw className={cn(loadingDevices && 'animate-spin')} />
          </Button>
        </div>
        {devices && devices.length === 0 ? (
          <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            No Spotify devices found. Open the Spotify app on the phone or speaker you want to use (play any song for a second), then tap refresh.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(devices ?? []).map((d) => (
              <button
                key={d.id}
                onClick={() => pick(d.id)}
                aria-pressed={active?.id === d.id}
                className={cn(
                  'cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition',
                  active?.id === d.id ? 'border-transparent bg-[#1ED760] text-black' : 'bg-card hover:bg-muted',
                )}
              >
                {d.name}
              </button>
            ))}
            {!devices && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
        )}
      </div>
    </div>
  )
}
