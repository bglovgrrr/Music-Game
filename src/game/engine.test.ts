import { describe, expect, it } from 'vitest'
import {
  askerOf,
  createGame,
  currentPick,
  currentRound,
  GameError,
  guessersFor,
  heardUpTo,
  isRevealed,
  pickTimeUp,
  scores,
  settingsOf,
  voteResults,
  MAX_PLAYERS,
  playbackPosition,
  reduce,
} from './engine'
import type { Action, GameState, Player, Settings, Track } from './types'

// ---------- helpers ----------
const T0 = 1_000_000
const player = (id: string, name = id): Player => ({ id, name, color: '#cfcaff' })
const track = (id: string, durationMs = 30_000): Track => ({ id, title: `Song ${id}`, artist: 'Artist', durationMs, source: 'demo' })

/** Apply actions in order; each item is [actorId, action, time?]. */
function play(s: GameState, steps: [string, Action, number?][]) {
  return steps.reduce((acc, [who, action, now]) => reduce(acc, action, who, now ?? T0), s)
}

/** A started game with players a (host), b, c and the asker on turn 0 (a). */
function started(n = 3) {
  const ids = ['a', 'b', 'c', 'd', 'e'].slice(0, n)
  let s = createGame(player('a'), 'ABCD', T0)
  for (const id of ids.slice(1)) s = reduce(s, { type: 'join', player: player(id) }, id, T0)
  return reduce(s, { type: 'start' }, 'a', T0)
}

/** Everyone has picked: now listening. */
function listening(n = 3) {
  const s = started(n)
  const ids = s.players.map((p) => p.id)
  return play(s, [['a', { type: 'ask', prompt: 'A song for a rainy day' }], ...ids.map((id): [string, Action] => [id, { type: 'pick', track: track(id) }])])
}

const expectError = (fn: () => unknown, msg: RegExp) => {
  expect(fn).toThrow(GameError)
  expect(fn).toThrow(msg)
}

// ---------- lobby ----------
describe('lobby', () => {
  it('creates a game with the host as the only player', () => {
    const s = createGame(player('a', 'Brian'), 'WXYZ', T0)
    expect(s).toMatchObject({ code: 'WXYZ', hostId: 'a', phase: 'lobby', turn: 0, rounds: [] })
    expect(s.players.map((p) => p.name)).toEqual(['Brian'])
  })

  it('lets players join, trims names, and ignores a second join', () => {
    let s = createGame(player('a'), 'ABCD', T0)
    s = reduce(s, { type: 'join', player: player('b', '  Maya  ') }, 'b')
    const again = reduce(s, { type: 'join', player: player('b', 'Maya') }, 'b')
    expect(s.players.map((p) => p.name)).toEqual(['a', 'Maya'])
    expect(again).toBe(s)
  })

  it('rejects blank names and full games', () => {
    const s = createGame(player('a'), 'ABCD', T0)
    expectError(() => reduce(s, { type: 'join', player: player('b', '   ') }, 'b'), /name/)
    let full = s
    for (let i = 1; i < MAX_PLAYERS; i++) full = reduce(full, { type: 'join', player: player(`p${i}`) }, `p${i}`)
    expect(full.players).toHaveLength(MAX_PLAYERS)
    expectError(() => reduce(full, { type: 'join', player: player('late') }, 'late'), /full/)
  })

  it('only lets the host start, and only with 2+ players', () => {
    const solo = createGame(player('a'), 'ABCD', T0)
    expectError(() => reduce(solo, { type: 'start' }, 'a'), /at least 2/)
    const duo = reduce(solo, { type: 'join', player: player('b') }, 'b')
    expectError(() => reduce(duo, { type: 'start' }, 'b'), /host/)
    expect(reduce(duo, { type: 'start' }, 'a').phase).toBe('asking')
  })

  it('rejects actions from people who are not in the game', () => {
    expectError(() => reduce(started(), { type: 'ask', prompt: 'hi' }, 'stranger'), /not in this game/)
  })
})

// ---------- asking ----------
describe('asking', () => {
  it('lets the asker ask, trimming the question and opening picks', () => {
    const s = reduce(started(), { type: 'ask', prompt: '  Your karaoke song  ', themeId: 'hype' }, 'a')
    expect(s.phase).toBe('picking')
    expect(currentRound(s)).toMatchObject({ number: 1, askerId: 'a', prompt: 'Your karaoke song', themeId: 'hype', picks: [] })
  })

  it("stops other players from asking on someone else's turn", () => {
    expectError(() => reduce(started(), { type: 'ask', prompt: 'Hi' }, 'b'), /not your turn/)
  })

  it("lets the host ask when it's someone else's turn (stuck asker)", () => {
    const s = play(listening(), [
      ['a', { type: 'next' }],
      ['a', { type: 'next' }],
      ['a', { type: 'next' }],
      ['a', { type: 'nextRound' }],
    ])
    expect(askerOf(s)!.id).toBe('b')
    const asked = reduce(s, { type: 'ask', prompt: 'Q2' }, 'a')
    expect(currentRound(asked)!.askerId).toBe('b')
  })

  it('rejects an empty question', () => {
    expectError(() => reduce(started(), { type: 'ask', prompt: '   ' }, 'a'), /question/)
  })
})

// ---------- picking ----------
describe('picking', () => {
  const asked = () => reduce(started(), { type: 'ask', prompt: 'Q' }, 'a')

  it('keeps one pick per player; picking again replaces it', () => {
    let s = reduce(asked(), { type: 'pick', track: track('first') }, 'b')
    s = reduce(s, { type: 'pick', track: track('second'), note: '  long story  ' }, 'b')
    const picks = currentRound(s)!.picks
    expect(picks).toHaveLength(1)
    expect(picks[0]).toMatchObject({ playerId: 'b', note: 'long story' })
    expect(picks[0].track.id).toBe('second')
  })

  it('lets a player take their pick back', () => {
    const s = play(asked(), [
      ['b', { type: 'pick', track: track('x') }],
      ['b', { type: 'unpick' }],
    ])
    expect(currentRound(s)!.picks).toHaveLength(0)
  })

  it('starts listening automatically when everyone has picked, asker first', () => {
    const s = listening()
    expect(s.phase).toBe('listening')
    expect(currentRound(s)!.order).toEqual(['a', 'b', 'c'])
    expect(currentPick(s)!.playerId).toBe('a')
    expect(s.playback.isPlaying).toBe(false)
  })

  it('goes around the circle starting from the asker', () => {
    let s = play(started(), [['a', { type: 'ask', prompt: 'Q' }], ...['a', 'b', 'c'].map((id): [string, Action] => [id, { type: 'pick', track: track(id) }])])
    s = play(s, [
      ['a', { type: 'next' }],
      ['a', { type: 'next' }],
      ['a', { type: 'next' }],
      ['a', { type: 'nextRound' }],
    ])
    expect(askerOf(s)!.id).toBe('b')
    s = play(s, [['b', { type: 'ask', prompt: 'Q2' }], ...['c', 'a', 'b'].map((id): [string, Action] => [id, { type: 'pick', track: track(id) }])])
    expect(currentRound(s)!.order).toEqual(['b', 'c', 'a'])
  })

  it('lets the asker start early, but not with zero picks and not other players', () => {
    const s = asked()
    expectError(() => reduce(s, { type: 'startListening' }, 'a'), /Nobody/)
    const one = reduce(s, { type: 'pick', track: track('b') }, 'b')
    expectError(() => reduce(one, { type: 'startListening' }, 'c'), /asker or host/)
    const early = reduce(one, { type: 'startListening' }, 'a')
    expect(early.phase).toBe('listening')
    expect(currentRound(early)!.order).toEqual(['b'])
  })

  it('closes picking once listening starts', () => {
    expectError(() => reduce(listening(), { type: 'pick', track: track('late') }, 'a'), /closed/)
  })
})

// ---------- listening ----------
describe('listening & playback', () => {
  it('tracks position from the time play was pressed', () => {
    const s = reduce(listening(), { type: 'play' }, 'b', T0)
    expect(s.playback).toEqual({ isPlaying: true, positionMs: 0, updatedAt: T0 })
    expect(playbackPosition(s, T0 + 4_000)).toBe(4_000)
    const paused = reduce(s, { type: 'pause' }, 'c', T0 + 4_000)
    expect(paused.playback).toMatchObject({ isPlaying: false, positionMs: 4_000 })
    expect(playbackPosition(paused, T0 + 60_000)).toBe(4_000)
  })

  it('never reports a position past the end of the song', () => {
    const s = reduce(listening(), { type: 'play' }, 'a', T0)
    expect(playbackPosition(s, T0 + 999_999)).toBe(30_000)
  })

  it('clamps seeking to the song', () => {
    const s = listening()
    expect(reduce(s, { type: 'seek', positionMs: -50 }, 'a').playback.positionMs).toBe(0)
    expect(reduce(s, { type: 'seek', positionMs: 90_000 }, 'a').playback.positionMs).toBe(30_000)
  })

  it('stops at the end of a song, and play after that starts it over', () => {
    const ended = reduce(listening(), { type: 'trackEnded' }, 'a', T0)
    expect(ended.playback).toMatchObject({ isPlaying: false, positionMs: 30_000 })
    expect(reduce(ended, { type: 'play' }, 'a', T0 + 10).playback).toMatchObject({ isPlaying: true, positionMs: 0 })
  })

  it('next plays the following song, and after the last one the round ends', () => {
    let s = reduce(listening(), { type: 'next' }, 'c', T0)
    expect(currentRound(s)!.current).toBe(1)
    expect(s.playback.isPlaying).toBe(true)
    s = play(s, [
      ['c', { type: 'next' }],
      ['c', { type: 'next' }],
    ])
    expect(s.phase).toBe('between')
  })

  it('ignores a duplicate next/prev tap aimed at a song that already changed', () => {
    const s = listening()
    const once = reduce(s, { type: 'next', from: 0 }, 'a')
    const twice = reduce(once, { type: 'next', from: 0 }, 'b')
    expect(currentRound(twice)!.current).toBe(1)
    expect(twice).toBe(once)
    expect(reduce(once, { type: 'prev', from: 0 }, 'b')).toBe(once)
  })

  it('prev restarts the song if more than 3s in, otherwise goes back', () => {
    const second = reduce(listening(), { type: 'next' }, 'a', T0)
    expect(currentRound(reduce(second, { type: 'prev' }, 'a', T0 + 1_000))!.current).toBe(0)
    const restarted = reduce(second, { type: 'prev' }, 'a', T0 + 5_000)
    expect(currentRound(restarted)!.current).toBe(1)
    expect(restarted.playback.positionMs).toBe(0)
  })

  it('going back keeps later songs uncovered (and you can jump forward to them again)', () => {
    let s = listening(4)
    for (let i = 0; i < 3; i++) s = reduce(s, { type: 'next', from: currentRound(s)!.current }, 'a', T0 + 1)
    s = reduce(s, { type: 'jump', index: 0 }, 'b', T0 + 2)
    const r = currentRound(s)!
    expect(r.current).toBe(0)
    expect(heardUpTo(r)).toBe(3)
    expect(currentRound(reduce(s, { type: 'jump', index: 3 }, 'b', T0 + 3))!.current).toBe(3)
    s = reduce(s, { type: 'next', from: 0 }, 'a', T0 + 4)
    expect(heardUpTo(currentRound(s)!)).toBe(3)
  })

  it('lets you jump back to a revealed song but not peek ahead', () => {
    const s = play(listening(), [['a', { type: 'next' }]])
    expect(currentRound(reduce(s, { type: 'jump', index: 0 }, 'b'))!.current).toBe(0)
    expectError(() => reduce(s, { type: 'jump', index: 2 }, 'b'), /peeking/)
  })
})

// ---------- rounds & leaving ----------
describe('rounds, ending and leaving', () => {
  it('passes the question to the next player and wraps around', () => {
    let s = started(2)
    for (const expected of ['a', 'b', 'a']) {
      expect(askerOf(s)!.id).toBe(expected)
      s = play(s, [
        [expected, { type: 'ask', prompt: 'Q' }],
        ['a', { type: 'pick', track: track('a') }],
        ['b', { type: 'pick', track: track('b') }],
        ['a', { type: 'next' }],
        ['a', { type: 'next' }],
        ['a', { type: 'nextRound' }],
      ])
    }
    expect(s.rounds).toHaveLength(3)
  })

  it('only lets the host end the game', () => {
    expectError(() => reduce(listening(), { type: 'end' }, 'b'), /host/)
    const s = reduce(listening(), { type: 'end' }, 'a')
    expect(s.phase).toBe('recap')
    expect(s.playback.isPlaying).toBe(false)
  })

  it('hands the host role to the next player when the host leaves', () => {
    const s = reduce(started(), { type: 'leave', playerId: 'a' }, 'a')
    expect(s.hostId).toBe('b')
    expect(s.players.map((p) => p.id)).toEqual(['b', 'c'])
  })

  it("keeps the turn valid when players leave, and doesn't let players remove each other", () => {
    // Finish two rounds so it's c's turn (turn = 2), then c leaves.
    const round = (s: GameState, asker: string) =>
      play(s, [
        [asker, { type: 'ask', prompt: 'Q' }],
        ...['a', 'b', 'c'].map((id): [string, Action] => [id, { type: 'pick', track: track(id) }]),
        ['a', { type: 'next' }],
        ['a', { type: 'next' }],
        ['a', { type: 'next' }],
        ['a', { type: 'nextRound' }],
      ])
    const s = round(round(started(), 'a'), 'b')
    expect(askerOf(s)!.id).toBe('c')
    expectError(() => reduce(s, { type: 'leave', playerId: 'c' }, 'b'), /host/)
    const after = reduce(s, { type: 'leave', playerId: 'c' }, 'c')
    expect(after.players).toHaveLength(2)
    expect(after.turn).toBeLessThan(after.players.length)
    expect(askerOf(after)).toBeDefined()
  })

  it('never mutates the state it was given', () => {
    const s = listening()
    const snapshot = structuredClone(s)
    reduce(s, { type: 'play' }, 'a')
    reduce(s, { type: 'next' }, 'a')
    reduce(s, { type: 'end' }, 'a')
    expect(s).toEqual(snapshot)
  })
})

// ---------- new features: settings, pick timer, guess who, votes ----------

/** Started game with settings applied by the host in the lobby. */
function startedWith(settings: Partial<Settings>, n = 3) {
  const ids = ['a', 'b', 'c', 'd', 'e'].slice(0, n)
  let s = createGame(player('a'), 'ABCD', T0)
  for (const id of ids.slice(1)) s = reduce(s, { type: 'join', player: player(id) }, id, T0)
  s = reduce(s, { type: 'settings', settings }, 'a', T0)
  return reduce(s, { type: 'start' }, 'a', T0)
}
const allPick = (s: GameState) =>
  play(
    s,
    s.players.map((p): [string, Action] => [p.id, { type: 'pick', track: track(p.id) }]),
  )

describe('settings', () => {
  it('defaults to no guessing and no timer, even for older saved games', () => {
    expect(settingsOf(createGame(player('a'), 'ABCD'))).toEqual({ guessMode: false, pickSeconds: null })
  })

  it('only the host changes settings, and not mid-round', () => {
    const s = createGame(player('a'), 'ABCD', T0)
    const duo = reduce(s, { type: 'join', player: player('b') }, 'b')
    expectError(() => reduce(duo, { type: 'settings', settings: { guessMode: true } }, 'b'), /host/)
    expectError(() => reduce(duo, { type: 'settings', settings: { pickSeconds: 7 } }, 'a'), /timer length/)
    expect(settingsOf(reduce(duo, { type: 'settings', settings: { guessMode: true, pickSeconds: 90 } }, 'a'))).toEqual({ guessMode: true, pickSeconds: 90 })
    expectError(() => reduce(listening(), { type: 'settings', settings: { guessMode: true } }, 'a'), /between rounds/)
  })
})

describe('pick timer', () => {
  it('sets a deadline when the question is asked', () => {
    const s = reduce(startedWith({ pickSeconds: 60 }), { type: 'ask', prompt: 'Q' }, 'a', T0)
    expect(currentRound(s)!.pickDeadline).toBe(T0 + 60_000)
    expect(pickTimeUp(currentRound(s)!, T0 + 59_999)).toBe(false)
    expect(pickTimeUp(currentRound(s)!, T0 + 60_000)).toBe(true)
  })

  it('lets anyone start listening once time is up (but not before)', () => {
    let s = reduce(startedWith({ pickSeconds: 60 }), { type: 'ask', prompt: 'Q' }, 'a', T0)
    s = reduce(s, { type: 'pick', track: track('b') }, 'b', T0 + 1_000)
    expectError(() => reduce(s, { type: 'startListening' }, 'c', T0 + 30_000), /asker or host/)
    expect(reduce(s, { type: 'startListening' }, 'c', T0 + 60_000).phase).toBe('listening')
  })

  it('has no deadline when the timer is off', () => {
    expect(currentRound(reduce(started(), { type: 'ask', prompt: 'Q' }, 'a'))!.pickDeadline).toBeUndefined()
  })
})

describe('guess who picked it', () => {
  const guessing = () => allPick(reduce(startedWith({ guessMode: true }), { type: 'ask', prompt: 'Q' }, 'a', T0))
  /** [owner of the first song, then the two other players] */
  const firstSong = (s: GameState) => {
    const owner = currentRound(s)!.order[0]
    return [owner, ...['a', 'b', 'c'].filter((id) => id !== owner)] as [string, string, string]
  }

  it('hides the picker until revealed', () => {
    const s = guessing()
    const r = currentRound(s)!
    expect(r.guessMode).toBe(true)
    expect(isRevealed(r, 'a')).toBe(false)
    expect(isRevealed(currentRound(listening())!, 'a')).toBe(true) // normal mode: always shown
  })

  it('reveals automatically once everyone else has guessed, and scores correct guesses', () => {
    let s = guessing()
    const [owner, x, y] = firstSong(s)
    s = reduce(s, { type: 'guess', owner, guessed: owner }, x)
    expect(isRevealed(currentRound(s)!, owner)).toBe(false)
    s = reduce(s, { type: 'guess', owner, guessed: x }, y)
    expect(isRevealed(currentRound(s)!, owner)).toBe(true)
    expect(scores(s)).toEqual({ [owner]: 0, [x]: 1, [y]: 0 })
  })

  it('does not count points before the reveal', () => {
    const s0 = guessing()
    const [owner, x] = firstSong(s0)
    const s = reduce(s0, { type: 'guess', owner, guessed: owner }, x)
    expect(scores(s)[x]).toBe(0)
  })

  it('lets you change your guess before the reveal', () => {
    const s0 = guessing()
    const [owner, x, y] = firstSong(s0)
    let s = reduce(s0, { type: 'guess', owner, guessed: y }, x)
    s = reduce(s, { type: 'guess', owner, guessed: owner }, x)
    expect(currentRound(s)!.guesses![owner]).toEqual({ [x]: owner })
  })

  it('blocks guessing your own song, guessing yourself, future songs, and after reveal', () => {
    const s = guessing()
    const [owner, x, y] = firstSong(s)
    const second = currentRound(s)!.order[1]
    expectError(() => reduce(s, { type: 'guess', owner, guessed: x }, owner), /own song/)
    expectError(() => reduce(s, { type: 'guess', owner, guessed: x }, x), /not your song/)
    expectError(() => reduce(s, { type: 'guess', owner: second, guessed: owner }, second === x ? y : x), /hasn't played/)
    const revealed = reduce(s, { type: 'reveal', owner }, y)
    expectError(() => reduce(revealed, { type: 'guess', owner, guessed: owner }, x), /Already revealed/)
  })

  it('reveals a song when you move on, and reveals everything played when the game ends', () => {
    const s0 = guessing()
    const [first, second, third] = currentRound(s0)!.order
    let s = reduce(s0, { type: 'next', from: 0 }, 'a')
    expect(isRevealed(currentRound(s)!, first)).toBe(true)
    expect(isRevealed(currentRound(s)!, second)).toBe(false)
    s = reduce(s, { type: 'end' }, 'a')
    expect(isRevealed(currentRound(s)!, second)).toBe(true)
    expect(isRevealed(currentRound(s)!, third)).toBe(false) // never played, stays hidden
  })

  it('shuffles the play order (same result on every phone) so it gives nothing away', () => {
    const s = guessing()
    const order = currentRound(s)!.order
    expect([...order].sort()).toEqual(['a', 'b', 'c'])
    // Same inputs give the same order: every phone agrees.
    expect(currentRound(guessing())!.order).toEqual(order)
  })

  it('counts everyone except the picker as a guesser', () => {
    expect(guessersFor(guessing(), 'a').map((p) => p.id)).toEqual(['b', 'c'])
  })
})

describe('song of the round', () => {
  const between = () =>
    play(listening(), [
      ['a', { type: 'next' }],
      ['a', { type: 'next' }],
      ['a', { type: 'next' }],
    ])

  it('collects votes and finds the winner, including ties', () => {
    let s = between()
    expect(s.phase).toBe('between')
    s = play(s, [
      ['a', { type: 'vote', owner: 'b' }],
      ['b', { type: 'vote', owner: 'c' }],
      ['c', { type: 'vote', owner: 'b' }],
    ])
    expect(voteResults(currentRound(s)!)).toEqual({ counts: { b: 2, c: 1 }, winners: ['b'] })
    s = reduce(s, { type: 'vote', owner: 'a' }, 'c') // change vote → tie
    expect(voteResults(currentRound(s)!).winners.sort()).toEqual(['a', 'b', 'c'])
  })

  it('blocks voting for yourself and voting outside the round summary', () => {
    expectError(() => reduce(between(), { type: 'vote', owner: 'a' }, 'a'), /own song/)
    expectError(() => reduce(listening(), { type: 'vote', owner: 'b' }, 'a'), /closed/)
  })
})

describe('group selfies', () => {
  const between = () =>
    play(listening(), [
      ['a', { type: 'next' }],
      ['a', { type: 'next' }],
      ['a', { type: 'next' }],
    ])

  it('lets anyone attach a selfie to a round, and replace or remove it', () => {
    const s0 = between()
    const roundId = currentRound(s0)!.id
    const s1 = reduce(s0, { type: 'photo', roundId, path: 'room/1.jpg' }, 'b', T0)
    expect(currentRound(s1)!.photo).toEqual({ path: 'room/1.jpg', by: 'b', takenAt: T0 })
    const s2 = reduce(s1, { type: 'photo', roundId, path: 'room/2.jpg' }, 'c', T0 + 1)
    expect(currentRound(s2)!.photo!.path).toBe('room/2.jpg')
    expect(currentRound(reduce(s2, { type: 'removePhoto', roundId }, 'a'))!.photo).toBeUndefined()
  })

  it('works on earlier rounds and in the recap, but not in the lobby or for unknown rounds', () => {
    const s = reduce(between(), { type: 'end' }, 'a')
    const roundId = currentRound(s)!.id
    expect(currentRound(reduce(s, { type: 'photo', roundId, path: 'p.jpg' }, 'c'))!.photo!.by).toBe('c')
    expectError(() => reduce(s, { type: 'photo', roundId: 'nope', path: 'p.jpg' }, 'c'), /no longer exists/)
    expectError(() => reduce(createGame(player('a'), 'ABCD'), { type: 'photo', roundId, path: 'p.jpg' }, 'a'), /after a round/)
  })
})
