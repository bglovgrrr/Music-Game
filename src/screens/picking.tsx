import { ArrowLeft, Headphones, Loader2, Lock, Pause, Play, Search, Timer, WifiOff } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { AlbumArt, PlayerAvatar, PromptCard, TrackRow } from '@/components/game-ui'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { askerOf, currentRound, MAX_NOTE_LENGTH, pickTimeUp, playerById } from '@/game/engine'
import type { Track } from '@/game/types'
import { useGame, useNow } from '@/hooks/use-game'
import { cn, formatTime } from '@/lib/utils'
import { searchTracks } from '@/music/search'

function useTrackSearch(query: string) {
  const [results, setResults] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [offline, setOffline] = useState(false)
  const [reason, setReason] = useState<string | undefined>()

  useEffect(() => {
    const q = query.trim()
    if (!q) return
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await searchTracks(q, ctrl.signal)
        setResults(r.tracks)
        setOffline(r.offline)
        setReason(r.reason)
        setLoading(false)
      } catch {
        /* aborted */
      }
    }, 450)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query])

  const empty = !query.trim()
  return { results: empty ? [] : results, loading: !empty && loading, offline, reason }
}

/** Quick listen on your own phone before you lock it in. */
/** Countdown for the pick timer; starts listening automatically when time's up. */
function PickTimer() {
  const { state, client } = useGame()
  const round = currentRound(state)!
  const deadline = round.pickDeadline
  const now = useNow(!!deadline, 250)
  const started = useRef<string | null>(null)
  const timeUp = !!deadline && pickTimeUp(round, now)

  useEffect(() => {
    if (!timeUp || !round.picks.length || started.current === round.id) return
    started.current = round.id
    try {
      client.dispatch({ type: 'startListening' })
    } catch {
      /* someone else's phone already started it */
    }
  }, [timeUp, round.picks.length, round.id, client])

  if (!deadline) return null
  const total = deadline - round.startedAt
  const left = Math.max(0, deadline - now)
  const pct = total > 0 ? (left / total) * 100 : 0
  const urgent = left <= 10_000
  return (
    <div className="grid gap-2" role="timer" aria-live="off">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <Timer className="size-4" /> {timeUp ? "Time's up" : 'Time to pick'}
        </span>
        <span className={cn('font-display text-xl tabular-nums', urgent && 'text-destructive')}>{formatTime(left + 999)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', urgent ? 'bg-destructive' : 'bg-[linear-gradient(90deg,var(--text-grad-1),var(--text-grad-2))]')}
          style={{ width: `${pct}%` }}
        />
      </div>
      {timeUp && !round.picks.length && <p className="text-xs text-muted-foreground">Listening starts as soon as someone picks.</p>}
    </div>
  )
}

function PreviewButton({ track }: { track: Track }) {
  const ref = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  useEffect(() => () => ref.current?.pause(), [])
  if (!track.previewUrl) return null
  const toggle = () => {
    if (!ref.current) {
      ref.current = new Audio(track.previewUrl)
      ref.current.onended = () => setPlaying(false)
    }
    if (playing) ref.current.pause()
    else ref.current.play().catch(() => setPlaying(false))
    setPlaying(!playing)
  }
  return (
    <Button variant="outline" size="sm" onClick={toggle}>
      {playing ? <Pause /> : <Headphones />} {playing ? 'Stop' : 'Preview'}
    </Button>
  )
}

export function PickingScreen() {
  const { state, dispatch, meId, isHost } = useGame()
  const round = currentRound(state)!
  const asker = playerById(state, round.askerId) ?? askerOf(state)
  const myPick = round.picks.find((p) => p.playerId === meId)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Track | null>(null)
  const [note, setNote] = useState('')
  const [changing, setChanging] = useState(false)
  const { results, loading, offline, reason } = useTrackSearch(query)
  const waitingOn = state.players.filter((p) => !round.picks.some((x) => x.playerId === p.id))
  const canForce = (isHost || asker?.id === meId) && round.picks.length > 0 && waitingOn.length > 0

  const lockIn = () => {
    if (!selected) return
    dispatch({ type: 'pick', track: selected, note })
    setSelected(null)
    setNote('')
    setQuery('')
    setChanging(false)
  }

  const showSearch = !myPick || changing

  return (
    <div className="grid gap-5 py-4 md:grid-cols-[1fr_280px] md:items-start md:gap-8">
      <div className="grid min-w-0 gap-5">
        <PromptCard prompt={round.prompt} asker={asker} />
        {round.pickDeadline && (
          <div className="md:hidden">
            <PickTimer />
          </div>
        )}

        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div key="confirm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <Card className="grid gap-4 p-4 sm:p-5">
                <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setSelected(null)}>
                  <ArrowLeft /> Back to results
                </Button>
                <div className="flex items-center gap-4">
                  <AlbumArt track={selected} className="size-24 shadow-lg" />
                  <div className="min-w-0">
                    <div className="truncate font-display text-2xl font-medium">{selected.title}</div>
                    <div className="truncate text-muted-foreground">{selected.artist}</div>
                    <div className="mt-2">
                      <PreviewButton track={selected} />
                    </div>
                  </div>
                </div>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">
                    Why this song? <span className="font-normal text-muted-foreground">(optional, shown when it plays)</span>
                  </span>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={MAX_NOTE_LENGTH} placeholder="A little teaser…" />
                </label>
                <Button variant="brand" size="lg" onClick={lockIn}>
                  <Lock /> Lock it in
                </Button>
              </Card>
            </motion.div>
          ) : showSearch ? (
            <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search songs or artists"
                  className="pl-12"
                  autoFocus
                  enterKeyHint="search"
                />
                {loading && <Loader2 className="absolute top-1/2 right-4 size-5 -translate-y-1/2 animate-spin text-muted-foreground" />}
              </div>
              {offline && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <WifiOff className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Live search is unavailable here. Showing a small built-in song list.
                    {reason && <span className="block opacity-80">{reason}</span>}
                  </span>
                </p>
              )}
              {changing && (
                <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setChanging(false)}>
                  <ArrowLeft /> Keep my pick
                </Button>
              )}
              <ul className="grid gap-1">
                {results.map((t) => (
                  <li key={t.id}>
                    <TrackRow track={t} onClick={() => setSelected(t)} right={<Play className="size-4 text-muted-foreground" />} />
                  </li>
                ))}
              </ul>
              {query.trim() && !loading && results.length === 0 && (
                <p className="py-6 text-center text-muted-foreground">No songs found. Try another search.</p>
              )}
              {!query.trim() && (
                <p className="py-6 text-center text-sm text-muted-foreground">Your pick stays secret until it plays.</p>
              )}
            </motion.div>
          ) : (
            <motion.div key="picked" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="grid gap-4 p-5 text-center">
                <p className="text-sm font-semibold tracking-wide text-success uppercase">Locked in</p>
                <AlbumArt track={myPick!.track} className="mx-auto size-40 shadow-xl" />
                <div>
                  <div className="font-display text-2xl font-medium">{myPick!.track.title}</div>
                  <div className="text-muted-foreground">{myPick!.track.artist}</div>
                </div>
                <Button variant="outline" className="justify-self-center" onClick={() => setChanging(true)}>
                  Change my pick
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <aside className="grid gap-3 md:sticky md:top-20">
        {round.pickDeadline && (
          <Card className="hidden p-4 md:block">
            <PickTimer />
          </Card>
        )}
        <Card className="p-4">
          <h3 className="mb-3 text-lg font-bold font-soft">
            {round.picks.length}/{state.players.length} picked
          </h3>
          <ul className="grid gap-3">
            {state.players.map((p) => {
              const done = round.picks.some((x) => x.playerId === p.id)
              return (
                <li key={p.id} className="flex items-center gap-3">
                  <PlayerAvatar player={p} size="sm" done={done} />
                  <span className="flex-1 truncate text-sm font-medium">{p.id === meId ? 'You' : p.name}</span>
                  <span className={done ? 'text-xs font-medium text-success' : 'text-xs text-muted-foreground'}>
                    {done ? 'Ready' : 'Choosing…'}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
        {canForce && (
          <Button variant="outline" onClick={() => dispatch({ type: 'startListening' })}>
            Start listening without {waitingOn.length === 1 ? waitingOn[0].name : `${waitingOn.length} players`}
          </Button>
        )}
      </aside>
    </div>
  )
}
