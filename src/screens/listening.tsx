import { Check, Eye, ExternalLink, ListMusic, MessageCircle, SkipForward, Speaker } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { AlbumArt, PlayerAvatar, PromptCard } from '@/components/game-ui'
import { ReactionBar } from '@/components/reactions'
import { PeekSheet } from '@/components/sheet'
import { CassetteDeck } from '@/components/cassette-deck'
import { SpotifyCard } from '@/components/spotify-card'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { currentPick, currentRound, guessersFor, heardUpTo, isRevealed, playbackPosition, playerById } from '@/game/engine'
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
  const options = round.order
    .filter((id) => id !== meId)
    .map((id) => playerById(state, id)!)
    .filter(Boolean)

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
  const right = Object.entries(guesses)
    .filter(([, g]) => g === owner)
    .map(([id]) => playerById(state, id))
    .filter(Boolean)
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
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-2.5 pt-1 pb-20 [@media(max-height:800px)]:gap-2 [@media(max-height:800px)]:pb-16">
      {/* Goal: listen together and react. The queue, Spotify and links live in the sheet. */}
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
          label={
            picker && revealed ? (
              <>
                <PlayerAvatar player={picker} size="sm" className="size-5" />
                <span className="truncate">Picked by {picker.id === meId ? 'you' : picker.name}</span>
              </>
            ) : round.guessMode ? (
              'Who picked it?'
            ) : undefined
          }
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
              <p className="line-clamp-1 max-w-full px-2">
                <span className="font-display text-xl font-bold [font-stretch:80%]">{pick.track.title}</span>
                <span className="text-muted-foreground"> · {pick.track.artist}</span>
              </p>
              <p className="line-clamp-2 min-h-[2.75rem] max-w-sm [@media(max-height:800px)]:line-clamp-1 [@media(max-height:800px)]:min-h-[1.4rem] text-balance font-note text-[1.05rem] leading-snug text-muted-foreground italic">
                {pick.note && revealed ? `“${pick.note}”` : ''}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
        {round.guessMode && revealed && <GuessResult />}
      </div>

      <AnimatePresence>
        {round.guessMode && !revealed && (
          <motion.div
            key={`guess-${pick.playerId}`}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="fixed inset-x-4 bottom-24 z-20 mx-auto max-w-md"
          >
            <GuessPanel />
          </motion.div>
        )}
      </AnimatePresence>

      {/* One slot at the bottom: reactions while it plays; when it stops, the "tell us" note takes their place */}
      <div className="mt-auto grid gap-2">
        <div className="grid h-[3.75rem] items-center [@media(max-height:700px)]:h-[3rem]">
          <AnimatePresence initial={false} mode="popLayout">
            {(ended || (!isPlaying && !fresh)) && picker && revealed ? (
              <motion.div key="talk" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="[grid-area:1/1]">
                <Card className="flex items-center gap-3 p-2.5 pl-3.5">
                  <MessageCircle className="size-5 shrink-0 text-accent" />
                  <p className="min-w-0 flex-1 text-sm leading-snug">
                    <span className="font-semibold">{picker.id === meId ? 'Your turn to talk' : `${picker.name}, tell us`}</span>
                    <span className="text-muted-foreground"> what this song means to you.</span>
                  </p>
                  <Button variant={ended ? 'brand' : 'secondary'} size="sm" onClick={() => dispatch({ type: 'next', from: round.current })}>
                    {isLast ? 'Finish' : 'Next'} <SkipForward />
                  </Button>
                </Card>
              </motion.div>
            ) : (
              <motion.div key="react" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="[grid-area:1/1]">
                <ReactionBar />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {!client.isSpeaker && host && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Speaker className="size-3.5" /> Playing on {host.name}'s phone
          </p>
        )}
      </div>

      <PeekSheet label="This round's mixtape" summary={`Song ${round.current + 1} of ${round.order.length}`} icon={<ListMusic />}>
        <div className="grid gap-4 pt-1">
          <ol className="grid gap-1">
            {round.order.map((pid, i) => {
              const p = round.picks.find((x) => x.playerId === pid)!
              const who = playerById(state, pid)
              const played = i <= heardUpTo(round)
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
                        {played ? p.track.artist : round.guessMode ? 'Coming up' : `${who?.id === meId ? 'Your' : `${who?.name}'s`} pick`}
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
          {client.isSpeaker && pick.track.spotifyUri && <SpotifyCard compact />}
          <div className="flex flex-wrap justify-center gap-2 text-sm">
            <Button variant="link" size="sm" asChild>
              <a
                href={pick.track.source === 'spotify' && pick.track.externalUrl ? pick.track.externalUrl : spotifySearchUrl(pick.track)}
                target="_blank"
                rel="noreferrer"
              >
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
      </PeekSheet>
    </div>
  )
}
