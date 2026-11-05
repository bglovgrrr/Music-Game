import { ArrowLeft, Headphones, Loader2, Lock, Pause, Play, Search, Timer, WifiOff } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { AlbumArt, PlayerAvatar, PromptCard, TrackRow } from '@/components/game-ui'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { askerOf, currentRound, MAX_NOTE_LENGTH, pickTimeUp, playerById } from '@/game/engine'
import type { Track } from '@/game/types'
import { themeName } from '@/game/prompts'
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
    <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-3 pt-1 pb-3">
      {/* Goal: find your song and lock it in. Everything else is a glance. */}
      <PromptCard prompt={round.prompt} topic={themeName(round.themeId)} asker={asker} compact />

      {/* who's picked: a slim strip of stickers on the table */}
      <div className="flex items-center gap-2 px-1">
        <span className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
          {round.picks.length}/{state.players.length} picked
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {state.players.map((p) => {
            const done = round.picks.some((x) => x.playerId === p.id)
            return <PlayerAvatar key={p.id} player={p} size="sm" done={done} className={cn('transition-opacity', !done && 'opacity-45')} />
          })}
        </div>
      </div>
      {round.pickDeadline && <PickTimer />}

      <AnimatePresence mode="wait">
        {selected ? (
          <motion.div key="confirm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="flex flex-1 flex-col gap-3">
            <Card className="grid gap-4 p-4">
              <button className="flex cursor-pointer items-center gap-1.5 justify-self-start text-sm text-muted-foreground" onClick={() => setSelected(null)}>
                <ArrowLeft className="size-4" /> Back to results
              </button>
              <div className="flex items-center gap-4">
                <AlbumArt track={selected} className="size-20 shrink-0 shadow-lg" rounded="rounded-[4px]" />
                <div className="min-w-0">
                  <div className="truncate font-display text-2xl leading-tight font-bold [font-stretch:80%]">{selected.title}</div>
                  <div className="truncate text-muted-foreground">{selected.artist}</div>
                  <div className="mt-2">
                    <PreviewButton track={selected} />
                  </div>
                </div>
              </div>
              <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={MAX_NOTE_LENGTH} placeholder="Why this song? (optional teaser)" aria-label="Why this song (optional, shown when it plays)" />
            </Card>
            <Button variant="brand" size="lg" className="mt-auto" onClick={lockIn}>
              <Lock /> Lock it in
            </Button>
          </motion.div>
        ) : showSearch ? (
          <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search songs or artists"
                className="paper pl-12"
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
              <button className="flex cursor-pointer items-center gap-1.5 justify-self-start text-sm text-muted-foreground" onClick={() => setChanging(false)}>
                <ArrowLeft className="size-4" /> Keep my pick
              </button>
            )}
            {/* results scroll inside this paper, the page itself stays put */}
            {results.length > 0 && (
              <Card className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
                <ul className="grid gap-0.5">
                  {results.map((t) => (
                    <li key={t.id}>
                      <TrackRow track={t} onClick={() => setSelected(t)} right={<Play className="size-4 text-muted-foreground" />} />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {query.trim() && !loading && results.length === 0 && <p className="py-6 text-center text-muted-foreground">No songs found. Try another search.</p>}
            {!query.trim() && <p className="py-6 text-center text-sm text-muted-foreground">Your pick stays secret until it plays.</p>}
          </motion.div>
        ) : (
          <motion.div key="picked" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="font-mono text-xs tracking-[0.16em] text-success uppercase">Locked in</p>
            <AlbumArt track={myPick!.track} className="size-36 shadow-xl [@media(max-height:700px)]:size-24" rounded="rounded-[4px]" />
            <div>
              <div className="font-display text-2xl leading-tight font-bold [font-stretch:80%]">{myPick!.track.title}</div>
              <div className="text-muted-foreground">{myPick!.track.artist}</div>
            </div>
            <Button variant="sketch" className="text-foreground [--sketch-ink:var(--foreground)]" onClick={() => setChanging(true)}>
              Change my pick
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {canForce && !selected && (
        <Button variant="outline" onClick={() => dispatch({ type: 'startListening' })}>
          Start listening without {waitingOn.length === 1 ? waitingOn[0].name : `${waitingOn.length} players`}
        </Button>
      )}
    </div>
  )
}
