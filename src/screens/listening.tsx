import { Check, Eye, ExternalLink, MessageCircle, SkipForward, Speaker } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { AlbumArt, Equalizer, PlayerAvatar, PromptCard } from '@/components/game-ui'
import { ReactionBar } from '@/components/reactions'
import { CassetteDeck } from '@/components/cassette-deck'
import { SpotifyCard } from '@/components/spotify-card'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { currentPick, currentRound, guessersFor, isRevealed, playbackPosition, playerById } from '@/game/engine'
import { themeName } from '@/game/prompts'
import { useGame, useNow } from '@/hooks/use-game'
import { spotifySearchUrl } from '@/music/search'
import { cn } from '@/lib/utils'

/** Guess who picked the song that's playing (guess mode, before the reveal). */
function GuessPanel() {
  const { state, dispatch, meId } = useGame()
  const round = currentRound(state)!
  const owner = round.order[round.current]
  const guesses = round.guesses?.[owner] ?? {}
  const guessers = guessersFor(state, owner)
  const done = guessers.filter((p) => guesses[p.id]).length
  const mine = guesses[meId]
  const options = round.order.filter((id) => id !== meId).map((id) => playerById(state, id)!).filter(Boolean)

  return (
    <Card className="mx-auto grid w-full max-w-md gap-4 p-4">
      {owner === meId ? (
        <div className="text-center">
          <p className="font-display text-xl font-medium">🤫 This one's yours</p>
          <p className="text-sm text-muted-foreground">Keep a straight face while they guess.</p>
        </div>
      ) : (
        <>
          <p className="text-center font-display text-xl font-medium">Who picked this?</p>
          <div className="flex flex-wrap justify-center gap-3">
            {options.map((p) => (
              <button
                key={p.id}
                onClick={() => dispatch({ type: 'guess', owner, guessed: p.id })}
                aria-pressed={mine === p.id}
                className={cn(
                  'grid cursor-pointer justify-items-center gap-1 rounded-2xl p-2 transition active:scale-95',
                  mine === p.id ? 'bg-secondary' : 'hover:bg-muted',
                )}
              >
                <PlayerAvatar player={p} size="lg" ring={mine === p.id} />
                <span className="max-w-16 truncate text-xs font-medium">{p.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <span className="text-sm text-muted-foreground">
          {done}/{guessers.length} guesses in
        </span>
        <Button variant="secondary" size="sm" onClick={() => dispatch({ type: 'reveal', owner })}>
          <Eye /> Reveal
        </Button>
      </div>
    </Card>
  )
}

/** After the reveal: who got it right. */
function GuessResult() {
  const { state, meId } = useGame()
  const round = currentRound(state)!
  const owner = round.order[round.current]
  const guesses = round.guesses?.[owner] ?? {}
  const right = Object.entries(guesses).filter(([, g]) => g === owner).map(([id]) => playerById(state, id)).filter(Boolean)
  if (!Object.keys(guesses).length) return null
  return (
    <p className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
      {right.length ? (
        <>
          <Check className="size-4 text-success" /> Guessed right:
          {right.map((p) => (
            <span key={p!.id} className="font-semibold text-foreground">
              {p!.id === meId ? 'you' : p!.name}
            </span>
          ))}
        </>
      ) : (
        'Nobody guessed it! 😮'
      )}
    </p>
  )
}

export function ListeningScreen() {
  const { state, dispatch, meId, client } = useGame()
  const host = playerById(state, state.hostId)
  const round = currentRound(state)!
  const pick = currentPick(state)!
  const picker = playerById(state, pick.playerId)
  const asker = playerById(state, round.askerId)
  const { isPlaying } = state.playback
  const now = useNow(isPlaying)
  const pos = playbackPosition(state, now)
  const dur = pick.track.durationMs
  const ended = !isPlaying && pos >= dur - 250
  const fresh = !isPlaying && pos === 0
  const isLast = round.current === round.order.length - 1
  const revealed = isRevealed(round, pick.playerId)
  // Which way the tape slides: forward (from the right) or back (from the left).
  const [prevIdx, setPrevIdx] = useState(round.current)
  const [dir, setDir] = useState<1 | -1>(1)
  if (round.current !== prevIdx) {
    setDir(round.current > prevIdx ? 1 : -1)
    setPrevIdx(round.current)
  }

  return (
    <div className="grid gap-6 py-4 md:grid-cols-[1fr_320px] md:gap-8">
      <div className="grid min-w-0 content-start gap-5">
        <PromptCard prompt={round.prompt} topic={themeName(round.themeId)} asker={asker} compact />

        {/* Changing song: only the tape slides (inside the deck) and the title cross-fades. */}
        <div className="grid justify-items-center gap-5 text-center">
            {/* The 80s cassette player, with the song's tape in the door */}
            <CassetteDeck
              track={pick.track}
              playing={isPlaying}
              positionMs={pos}
              durationMs={dur}
              preview={!!pick.track.previewUrl || pick.track.source === 'demo'}
              isLast={isLast}
              back={picker && revealed ? `Picked by ${picker.id === meId ? 'you' : picker.name}` : round.guessMode ? 'Who picked it?' : undefined}
              onPlay={() => !isPlaying && dispatch({ type: 'play' })}
              onPause={() => isPlaying && dispatch({ type: 'pause' })}
              onPrev={() => dispatch({ type: 'prev', from: round.current })}
              onNext={() => dispatch({ type: 'next', from: round.current })}
              onSeek={(ms) => dispatch({ type: 'seek', positionMs: ms })}
              direction={dir}
            />

            {/* Fixed-height block: title, artist, who picked it and their note cross-fade together,
                so nothing below moves when the song changes. */}
            <div className="grid w-full">
              <AnimatePresence initial={false}>
                <motion.div
                  key={pick.playerId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, ease: 'easeInOut' }}
                  className="grid content-start justify-items-center gap-1 [grid-area:1/1]"
                >
                  <h2 className="line-clamp-1 text-3xl font-bold font-soft sm:text-4xl">{pick.track.title}</h2>
                  <p className="line-clamp-1 text-lg text-muted-foreground">{pick.track.artist}</p>
                  <div className="mt-2 grid h-9 place-items-center">
                    {picker && revealed && (
                      <motion.div
                        initial={round.guessMode ? { scale: 0.8, opacity: 0 } : false}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                        className="flex items-center gap-2 rounded-full bg-secondary py-1 pr-4 pl-1 text-secondary-foreground"
                      >
                        <PlayerAvatar player={picker} size="sm" />
                        <span className="text-sm font-medium">Picked by {picker.id === meId ? 'you' : picker.name}</span>
                        <Equalizer playing={isPlaying} className="ml-1 text-accent" />
                      </motion.div>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 min-h-[3rem] max-w-sm text-balance font-note text-lg leading-snug text-muted-foreground italic">
                    {pick.note && revealed ? `“${pick.note}”` : ''}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
            {round.guessMode && revealed && <GuessResult />}
        </div>

        {round.guessMode && !revealed && <GuessPanel />}

        <ReactionBar />

        {client.isSpeaker && pick.track.spotifyUri && <SpotifyCard compact className="-mt-1" />}

        {!client.isSpeaker && host && (
          <p className="-mt-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Speaker className="size-3.5" /> Playing on {host.name}'s device
          </p>
        )}

        <AnimatePresence>
          {(ended || (!isPlaying && !fresh)) && picker && revealed && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="mx-auto flex max-w-md items-start gap-3 p-4">
                <MessageCircle className="mt-0.5 size-5 shrink-0 text-accent" />
                <div className="grid gap-3">
                  <p>
                    <span className="font-semibold">{picker.id === meId ? 'Your turn to talk' : `${picker.name}, tell us`}</span>
                    <span className="text-muted-foreground"> — what does this song mean to you?</span>
                  </p>
                  <Button variant={ended ? 'brand' : 'secondary'} size="sm" className="justify-self-start" onClick={() => dispatch({ type: 'next', from: round.current })}>
                    {isLast ? 'Finish round' : 'Next song'} <SkipForward />
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-center gap-2 text-sm">
          <Button variant="link" size="sm" asChild>
            <a href={pick.track.source === 'spotify' && pick.track.externalUrl ? pick.track.externalUrl : spotifySearchUrl(pick.track)} target="_blank" rel="noreferrer">
              Open in Spotify <ExternalLink />
            </a>
          </Button>
          {pick.track.externalUrl && pick.track.source === 'itunes' && (
            <Button variant="link" size="sm" asChild>
              <a href={pick.track.externalUrl} target="_blank" rel="noreferrer">
                Apple Music <ExternalLink />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Queue */}
      <aside className="md:sticky md:top-20 md:self-start">
        <Card className="p-3">
          <h3 className="px-2 pt-1 pb-2 text-lg font-bold font-soft">This round's mixtape</h3>
          <ol className="grid gap-1">
            {round.order.map((pid, i) => {
              const p = round.picks.find((x) => x.playerId === pid)!
              const who = playerById(state, pid)
              const played = i <= round.current
              const showWho = played && isRevealed(round, pid)
              const active = i === round.current
              return (
                <li key={pid}>
                  <button
                    disabled={!played}
                    onClick={() => dispatch({ type: 'jump', index: i })}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors',
                      played && 'cursor-pointer hover:bg-muted',
                      active && 'bg-secondary',
                    )}
                  >
                    <AlbumArt track={p.track} hidden={!played} className="size-11 shrink-0" rounded="rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{played ? p.track.title : 'Mystery song'}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {played
                          ? p.track.artist
                          : round.guessMode
                            ? 'Coming up'
                            : `${who?.id === meId ? 'Your' : `${who?.name}'s`} pick`}
                      </div>
                    </div>
                    {who && (showWho || !round.guessMode) ? (
                      <PlayerAvatar player={who} size="sm" />
                    ) : (
                      <span className="grid size-7 place-items-center rounded-full border border-dashed text-xs text-muted-foreground">?</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ol>
        </Card>
      </aside>
    </div>
  )
}
