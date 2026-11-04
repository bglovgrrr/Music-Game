import { Check, Copy, Loader2, RefreshCw, Speaker, Stethoscope } from 'lucide-react'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useSpotifyConnected } from '@/hooks/use-spotify'
import { connectSpotify, disconnectSpotify, SpotifyError, spotifyConfigured } from '@/music/spotify-auth'
import { testSpotify } from '@/music/spotify-diagnostics'
import { onSpotifyLog, spotifyLogLines } from '@/music/spotify-log'
import { chooseDevice, chosenDeviceId, isIOS, listDevices, LOCAL, localPlayerUsable, needsKeepAlive, playSilence, setKeepAliveDevice, type SpotifyDevice } from '@/music/spotify-player'
import { ensureLocalPlayer, LOCAL_PLAYER_NAME, localDeviceId, localPlayerProblem, onLocalPlayer, stopLocalPlayer } from '@/music/spotify-sdk'
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
  const [device, setDevice] = useState<string>(() => chosenDeviceId() ?? (localPlayerUsable() ? LOCAL : ''))
  const canUseLocal = localPlayerUsable()
  const localId = useSyncExternalStore(onLocalPlayer, localDeviceId)
  const localProblem = useSyncExternalStore(onLocalPlayer, localPlayerProblem)
  const [loadingDevices, setLoadingDevices] = useState(false)
  const [report, setReport] = useState<string[] | null>(null)
  const [testing, setTesting] = useState(false)

  const runTest = async () => {
    setTesting(true)
    const lines: string[] = []
    setReport(lines)
    try {
      await testSpotify((line) => {
        lines.push(line)
        setReport([...lines])
      })
    } catch (err) {
      lines.push(`✗ ${(err as Error).message}`)
      setReport([...lines])
    } finally {
      setTesting(false)
    }
  }

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText((report ?? []).join('\n'))
      toast.success('Copied')
    } catch {
      toast.error('Couldn’t copy. Take a screenshot instead.')
    }
  }

  const refresh = useCallback(async () => {
    setLoadingDevices(true)
    try {
      // Side B's own player is listed separately (first), so leave it out here.
      setDevices((await listDevices()).filter((d) => d.name !== LOCAL_PLAYER_NAME))
    } catch (err) {
      setDevices([])
      if (err instanceof SpotifyError) toast.error(err.message)
    } finally {
      setLoadingDevices(false)
    }
  }, [])

  useEffect(() => {
    if (!connected) return
    void refresh()
    if (canUseLocal) void ensureLocalPlayer()
  }, [connected, refresh, canUseLocal])

  // Back from the Spotify app ("Wake up Spotify"): find the phone, use it, and keep it awake.
  useEffect(() => {
    if (!connected) return
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return
      const list = (await listDevices().catch(() => [])).filter((d) => d.name !== LOCAL_PLAYER_NAME)
      setDevices(list)
      const current = chosenDeviceId()
      const phone = list.find(needsKeepAlive)
      if (phone && (!current || (current === LOCAL && !canUseLocal) || !list.some((d) => d.id === current))) {
        chooseDevice(phone.id)
        setDevice(phone.id)
      }
      if (phone && (chosenDeviceId() === phone.id)) {
        setKeepAliveDevice(phone.id)
        await playSilence().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [connected, canUseLocal])

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

  const usingLocal = device === LOCAL && canUseLocal
  const active = usingLocal ? undefined : (devices?.find((d) => d.id === device) ?? devices?.find((d) => d.is_active) ?? devices?.[0])
  if (compact) return <CompactStatus active={usingLocal ? 'this device' : active?.name} className={className} />

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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            stopLocalPlayer()
            disconnectSpotify()
          }}
        >
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
        <div className="flex flex-wrap gap-2">
          {canUseLocal && (
            <button
              onClick={() => pick(LOCAL)}
              aria-pressed={usingLocal}
              className={cn(
                'cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition',
                usingLocal ? 'border-transparent bg-[#1ED760] text-black' : 'bg-card hover:bg-muted',
              )}
            >
              This device {localId ? '' : localProblem ? '⚠' : '…'}
            </button>
          )}
          {(devices ?? []).map((d) => (
            <button
              key={d.id}
              onClick={() => pick(d.id)}
              aria-pressed={!usingLocal && active?.id === d.id}
              className={cn(
                'cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition',
                !usingLocal && active?.id === d.id ? 'border-transparent bg-[#1ED760] text-black' : 'bg-card hover:bg-muted',
              )}
            >
              {d.name}
            </button>
          ))}
          {!devices && <Loader2 className="size-4 animate-spin self-center text-muted-foreground" />}
        </div>
        <p className="text-xs text-muted-foreground">
          {usingLocal
            ? localProblem
              ? `${localProblem}. Pick another device, or open Spotify on one and tap refresh.`
              : 'Music plays right here in Side B. No Spotify app needed. Keep this screen open.'
            : active && needsKeepAlive(active)
              ? 'Music plays through the Spotify app on this phone. Side B keeps it awake between songs (with silence), so you don’t need to switch apps.'
              : active
                ? 'Music plays in Spotify on that device.'
                : 'No Spotify found yet.'}
        </p>
        {!canUseLocal && !(active && needsKeepAlive(active)) && (
          <div className="grid gap-2 rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              {isIOS() ? 'On iPhone, the music plays through the Spotify app. ' : ''}Tap below, then come straight back here. Side B keeps Spotify awake for the
              rest of the game.
            </p>
            <Button asChild size="sm" className="justify-self-start bg-[#1ED760] text-black hover:bg-[#1ED760]/90">
              <a href="spotify:">Wake up Spotify</a>
            </Button>
          </div>
        )}
      </div>
      <div className="grid gap-2">
        <Button variant="outline" size="sm" onClick={runTest} disabled={testing} className="justify-self-start">
          {testing ? <Loader2 className="animate-spin" /> : <Stethoscope />} Test Spotify
        </Button>
        {report && (
          <div className="grid gap-2 rounded-xl bg-muted p-3">
            <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap">{report.join('\n')}</pre>
            {!testing && (
              <Button variant="ghost" size="sm" onClick={copyReport} className="justify-self-start">
                <Copy /> Copy result
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

let logSnapshot: string[] = []
const readLog = () => {
  const next = spotifyLogLines()
  if (next.length !== logSnapshot.length || next[next.length - 1] !== logSnapshot[logSnapshot.length - 1]) logSnapshot = next
  return logSnapshot
}

/** One line under the controls; tap it to see what Spotify reported (to copy when something goes wrong). */
function CompactStatus({ active, className }: { active?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const log = useSyncExternalStore(onSpotifyLog, readLog)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(log.join('\n'))
      toast.success('Copied')
    } catch {
      toast.error('Couldn’t copy. Take a screenshot instead.')
    }
  }
  return (
    <div className={cn('grid justify-items-center gap-2', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        <SpotifyLogo className="size-3.5" /> Full songs on Spotify{active ? ` · ${active}` : ''}
      </button>
      {open && (
        <div className="grid w-full max-w-md gap-2 rounded-xl bg-muted p-3">
          <pre className="max-h-56 overflow-auto font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
            {log.length ? log.join('\n') : 'Nothing yet. Tap play.'}
          </pre>
          <Button variant="ghost" size="sm" onClick={copy} className="justify-self-start">
            <Copy /> Copy log
          </Button>
        </div>
      )}
    </div>
  )
}

