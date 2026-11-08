import { clock } from '@/lib/clock'
import { REACTION_EMOJIS, type Action, type GameState, type Pick, type Player, type Round, type Settings } from './types'

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8
export const MAX_PROMPT_LENGTH = 160
export const MAX_NOTE_LENGTH = 140
export const PICK_TIMER_OPTIONS = [60, 90, 120] as const
const DEFAULT_SETTINGS: Settings = { guessMode: false, pickSeconds: null }

export const settingsOf = (s: GameState): Settings => ({ ...DEFAULT_SETTINGS, ...s.settings })

export class GameError extends Error {}

const fail = (msg: string): never => {
  throw new GameError(msg)
}

export function createGame(host: Player, code: string, now = clock.now()): GameState {
  return {
    id: `game_${code}_${now}`,
    code,
    hostId: host.id,
    phase: 'lobby',
    players: [host],
    rounds: [],
    turn: 0,
    playback: { isPlaying: false, positionMs: 0, updatedAt: now },
    createdAt: now,
  }
}

export const currentRound = (s: GameState): Round | undefined => s.rounds[s.rounds.length - 1]

export const askerOf = (s: GameState): Player | undefined =>
  s.players.length ? s.players[s.turn % s.players.length] : undefined

export const playerById = (s: GameState, id: string) => s.players.find((p) => p.id === id)

export function currentPick(s: GameState): Pick | undefined {
  const r = currentRound(s)
  if (!r) return undefined
  const pid = r.order[r.current]
  return r.picks.find((p) => p.playerId === pid)
}

/** In guess mode a song's picker stays hidden until it's revealed. */
export const isRevealed = (r: Round, ownerId: string) => !r.guessMode || (r.revealed ?? []).includes(ownerId)

/** People who can guess a song: everyone in the game except whoever picked it. */
export const guessersFor = (s: GameState, ownerId: string) => s.players.filter((p) => p.id !== ownerId)

/** Points from correct guesses across the whole game (revealed songs only). */
export function scores(s: GameState): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(s.players.map((p) => [p.id, 0]))
  for (const r of s.rounds) {
    for (const [owner, byGuesser] of Object.entries(r.guesses ?? {})) {
      if (!isRevealed(r, owner)) continue
      for (const [guesser, guessed] of Object.entries(byGuesser)) {
        if (guessed === owner) out[guesser] = (out[guesser] ?? 0) + 1
      }
    }
  }
  return out
}

/** Vote counts for a round, and the winning song owner(s). */
export function voteResults(r: Round) {
  const counts: Record<string, number> = {}
  for (const owner of Object.values(r.votes ?? {})) counts[owner] = (counts[owner] ?? 0) + 1
  const top = Math.max(0, ...Object.values(counts))
  const winners = top > 0 ? Object.keys(counts).filter((o) => counts[o] === top) : []
  return { counts, winners }
}

/** Reactions each player's songs received across the game, and their most-used emoji. */
export function reactionTotals(s: GameState): Record<string, { total: number; top?: string }> {
  const out: Record<string, { total: number; byEmoji: Record<string, number> }> = {}
  for (const r of s.rounds) {
    for (const [owner, counts] of Object.entries(r.reactions ?? {})) {
      const o = (out[owner] ??= { total: 0, byEmoji: {} })
      for (const [emoji, n] of Object.entries(counts)) {
        o.total += n
        o.byEmoji[emoji] = (o.byEmoji[emoji] ?? 0) + n
      }
    }
  }
  return Object.fromEntries(
    Object.entries(out).map(([id, o]) => [id, { total: o.total, top: Object.entries(o.byEmoji).sort((a, b) => b[1] - a[1])[0]?.[0] }]),
  )
}

/** The player(s) whose songs got the most reactions (needs at least one). */
export function fanFavorites(s: GameState): string[] {
  const t = reactionTotals(s)
  const best = Math.max(0, ...Object.values(t).map((x) => x.total))
  return best > 0 ? Object.keys(t).filter((id) => t[id].total === best) : []
}

export const songReactionTotal = (r: Round, owner: string) => Object.values(r.reactions?.[owner] ?? {}).reduce((a, b) => a + b, 0)

/** Pick timer ran out. */
export const pickTimeUp = (r: Round, now = clock.now()) => r.pickDeadline !== undefined && now >= r.pickDeadline

export function playbackPosition(s: GameState, now = clock.now()) {
  const pb = s.playback
  const pos = pb.isPlaying ? pb.positionMs + (now - pb.updatedAt) : pb.positionMs
  const max = currentPick(s)?.track.durationMs ?? Infinity
  return Math.min(Math.max(0, pos), max)
}

/**
 * Play order: start with the asker, then go around the circle.
 * In guess mode the order is shuffled (otherwise the order gives the answer away).
 * The shuffle is seeded by the round id so every phone gets the same order.
 */
function playOrder(s: GameState, r: Round): string[] {
  const pickedIds = new Set(r.picks.map((p) => p.playerId))
  const start = Math.max(0, s.players.findIndex((p) => p.id === r.askerId))
  const seats = [...s.players.slice(start), ...s.players.slice(0, start)]
  const order = seats.map((p) => p.id).filter((id) => pickedIds.has(id))
  return r.guessMode ? seededShuffle(order, r.id) : order
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function withRound(s: GameState, r: Round): GameState {
  return { ...s, rounds: [...s.rounds.slice(0, -1), r] }
}

function startListening(s: GameState, now: number): GameState {
  const r = currentRound(s)!
  return {
    ...withRound(s, { ...r, order: playOrder(s, r), current: 0 }),
    phase: 'listening',
    playback: { isPlaying: false, positionMs: 0, updatedAt: now },
  }
}

function reveal(r: Round, owner: string): Round {
  if (!r.guessMode || (r.revealed ?? []).includes(owner)) return r
  return { ...r, revealed: [...(r.revealed ?? []), owner] }
}

function loadTrack(s: GameState, index: number, autoplay: boolean, now: number): GameState {
  let r = currentRound(s)!
  // Moving on from a song reveals who picked it.
  if (index !== r.current && r.order[r.current]) r = reveal(r, r.order[r.current])
  return {
    ...withRound(s, { ...r, current: index, furthest: Math.max(index, heardUpTo(r)) }),
    playback: { isPlaying: autoplay, positionMs: 0, updatedAt: now },
  }
}

/** Index of the furthest song reached in a round (older games: the current one). */
export const heardUpTo = (r: Round) => Math.max(r.furthest ?? 0, r.current)

/**
 * The whole game's rules. Pure function: (state, action, who did it) -> new state.
 * The same rules run in demo mode and (later) online mode.
 */
export function reduce(s: GameState, a: Action, actorId: string, now = clock.now()): GameState {
  const isHost = actorId === s.hostId
  const actor = playerById(s, actorId)
  if (a.type !== 'join' && !actor) fail('You are not in this game.')
  const round = currentRound(s)
  const isAsker = askerOf(s)?.id === actorId

  switch (a.type) {
    case 'join': {
      if (s.players.some((p) => p.id === a.player.id)) return s
      if (s.players.length >= MAX_PLAYERS) fail('This game is full.')
      const name = a.player.name.trim().slice(0, 24)
      if (!name) fail('Pick a name first.')
      return { ...s, players: [...s.players, { ...a.player, name }] }
    }

    case 'leave': {
      if (a.playerId !== actorId && !isHost) fail('Only the host can remove players.')
      const players = s.players.filter((p) => p.id !== a.playerId)
      const hostId = s.hostId === a.playerId ? (players[0]?.id ?? s.hostId) : s.hostId
      return { ...s, players, hostId, turn: players.length ? s.turn % players.length : 0 }
    }

    case 'start': {
      if (s.phase !== 'lobby') fail('The game already started.')
      if (!isHost) fail('Only the host can start the game.')
      if (s.players.length < MIN_PLAYERS) fail(`You need at least ${MIN_PLAYERS} players.`)
      return { ...s, phase: 'asking', turn: 0 }
    }

    case 'ask': {
      if (s.phase !== 'asking') fail('It is not time to ask a question.')
      if (!isAsker && !isHost) fail("It's not your turn to ask.")
      const prompt = a.prompt.trim().slice(0, MAX_PROMPT_LENGTH)
      if (!prompt) fail('Write a question first.')
      const settings = settingsOf(s)
      const r: Round = {
        id: `r${s.rounds.length + 1}_${now}`,
        number: s.rounds.length + 1,
        askerId: askerOf(s)!.id,
        prompt,
        themeId: a.themeId,
        picks: [],
        order: [],
        current: 0,
        startedAt: now,
        pickDeadline: settings.pickSeconds ? now + settings.pickSeconds * 1000 : undefined,
        guessMode: settings.guessMode || undefined,
        guesses: settings.guessMode ? {} : undefined,
        revealed: settings.guessMode ? [] : undefined,
      }
      return { ...s, phase: 'picking', rounds: [...s.rounds, r] }
    }

    case 'pick': {
      if (s.phase !== 'picking' || !round) fail('Picking is closed.')
      const pick: Pick = {
        playerId: actorId,
        track: a.track,
        note: a.note?.trim().slice(0, MAX_NOTE_LENGTH) || undefined,
        pickedAt: now,
      }
      const picks = [...round!.picks.filter((p) => p.playerId !== actorId), pick]
      const next = withRound(s, { ...round!, picks })
      return picks.length >= s.players.length ? startListening(next, now) : next
    }

    case 'unpick': {
      if (s.phase !== 'picking' || !round) fail('Picking is closed.')
      return withRound(s, { ...round!, picks: round!.picks.filter((p) => p.playerId !== actorId) })
    }

    case 'startListening': {
      if (s.phase !== 'picking' || !round) fail('Nothing to listen to yet.')
      if (!isAsker && !isHost && !pickTimeUp(round!, now)) fail('Only the asker or host can start early.')
      if (!round!.picks.length) fail('Nobody has picked a song yet.')
      return startListening(s, now)
    }

    case 'play': {
      if (s.phase !== 'listening') fail('Nothing is playing.')
      const pos = playbackPosition(s, now)
      const ended = pos >= (currentPick(s)?.track.durationMs ?? 0) - 250
      return { ...s, playback: { isPlaying: true, positionMs: ended ? 0 : pos, updatedAt: now } }
    }

    case 'pause':
      if (s.phase !== 'listening') return s
      return { ...s, playback: { isPlaying: false, positionMs: playbackPosition(s, now), updatedAt: now } }

    case 'seek': {
      if (s.phase !== 'listening') return s
      const max = currentPick(s)?.track.durationMs ?? 0
      const positionMs = Math.min(Math.max(0, a.positionMs), max)
      return { ...s, playback: { ...s.playback, positionMs, updatedAt: now } }
    }

    case 'trackEnded': {
      if (s.phase !== 'listening') return s
      const max = currentPick(s)?.track.durationMs ?? 0
      return { ...s, playback: { isPlaying: false, positionMs: max, updatedAt: now } }
    }

    case 'next': {
      if (s.phase !== 'listening' || !round) return s
      if (a.from !== undefined && a.from !== round!.current) return s
      if (round!.current < round!.order.length - 1) return loadTrack(s, round!.current + 1, true, now)
      return {
        ...withRound(s, reveal(round!, round!.order[round!.current])),
        phase: 'between',
        playback: { isPlaying: false, positionMs: 0, updatedAt: now },
      }
    }

    case 'prev': {
      if (s.phase !== 'listening' || !round) return s
      if (a.from !== undefined && a.from !== round!.current) return s
      if (playbackPosition(s, now) > 3000 || round!.current === 0) return loadTrack(s, round!.current, s.playback.isPlaying, now)
      return loadTrack(s, round!.current - 1, true, now)
    }

    case 'jump': {
      if (s.phase !== 'listening' || !round) return s
      if (a.index < 0 || a.index >= round!.order.length) return s
      if (a.index > heardUpTo(round!)) fail("No peeking! Songs are revealed in order.")
      return loadTrack(s, a.index, true, now)
    }

    case 'nextRound': {
      if (s.phase !== 'between' && s.phase !== 'listening') fail('Finish this round first.')
      return {
        ...s,
        phase: 'asking',
        turn: (s.turn + 1) % s.players.length,
        playback: { isPlaying: false, positionMs: 0, updatedAt: now },
      }
    }

    case 'end': {
      if (!isHost) fail('Only the host can end the game.')
      // Reveal everything that was played, so the recap and scores are complete.
      const rounds = s.rounds.map((r) =>
        r.order.slice(0, s.phase === 'listening' && r === round ? r.current + 1 : r.order.length).reduce(reveal, r),
      )
      return { ...s, rounds, phase: 'recap', playback: { isPlaying: false, positionMs: 0, updatedAt: now } }
    }

    case 'settings': {
      if (!isHost) fail('Only the host can change settings.')
      if (s.phase === 'picking' || s.phase === 'listening' || s.phase === 'recap') fail('Change settings between rounds.')
      const next = { ...settingsOf(s), ...a.settings }
      if (next.pickSeconds !== null && !(PICK_TIMER_OPTIONS as readonly number[]).includes(next.pickSeconds)) fail('Pick a timer length from the list.')
      return { ...s, settings: { guessMode: !!next.guessMode, pickSeconds: next.pickSeconds } }
    }

    case 'guess': {
      if (s.phase !== 'listening' || !round?.guessMode) fail('No guessing right now.')
      const idx = round!.order.indexOf(a.owner)
      if (idx < 0 || idx > round!.current) fail("That song hasn't played yet.")
      if (isRevealed(round!, a.owner)) fail('Already revealed.')
      if (actorId === a.owner) fail("You can't guess your own song.")
      if (a.guessed === actorId) fail("It's not your song. Guess someone else!")
      if (!round!.order.includes(a.guessed)) fail('That player didn’t pick a song this round.')
      const forSong = { ...(round!.guesses?.[a.owner] ?? {}), [actorId]: a.guessed }
      let r: Round = { ...round!, guesses: { ...round!.guesses, [a.owner]: forSong } }
      // Everyone has guessed: reveal automatically.
      if (guessersFor(s, a.owner).every((p) => forSong[p.id])) r = reveal(r, a.owner)
      return withRound(s, r)
    }

    case 'reveal': {
      if (s.phase !== 'listening' || !round?.guessMode) return s
      const idx = round!.order.indexOf(a.owner)
      if (idx < 0 || idx > round!.current) fail("That song hasn't played yet.")
      return withRound(s, reveal(round!, a.owner))
    }

    case 'photo':
    case 'removePhoto': {
      if (s.phase === 'lobby') fail('Take a selfie after a round.')
      const idx = s.rounds.findIndex((r) => r.id === a.roundId)
      if (idx < 0) fail('That round no longer exists.')
      const target = s.rounds[idx]
      if (a.type === 'photo' && !a.path) fail('No photo to save.')
      const updated: Round = a.type === 'photo' ? { ...target, photo: { path: a.path, by: actorId, takenAt: now } } : { ...target, photo: undefined }
      return { ...s, rounds: s.rounds.map((r, i) => (i === idx ? updated : r)) }
    }

    case 'reactions': {
      if (!isHost) fail('Only the host records reactions.')
      const idx = s.rounds.findIndex((r) => r.id === a.roundId)
      if (idx < 0) return s
      const target = s.rounds[idx]
      if (!target.order.includes(a.owner)) fail('That song isn’t in this round.')
      const prev = target.reactions?.[a.owner] ?? {}
      const merged = { ...prev }
      for (const [emoji, n] of Object.entries(a.counts)) {
        if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) continue
        const add = Math.max(0, Math.min(1000, Math.floor(Number(n) || 0)))
        if (add) merged[emoji] = (merged[emoji] ?? 0) + add
      }
      const updated: Round = { ...target, reactions: { ...target.reactions, [a.owner]: merged } }
      return { ...s, rounds: s.rounds.map((r, i) => (i === idx ? updated : r)) }
    }

    case 'vote': {
      if (s.phase !== 'between' || !round) fail('Voting is closed.')
      if (!round!.order.includes(a.owner)) fail('That song isn’t in this round.')
      if (a.owner === actorId) fail("You can't vote for your own song.")
      return withRound(s, { ...round!, votes: { ...round!.votes, [actorId]: a.owner } })
    }
  }
}
