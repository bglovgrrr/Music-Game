import { describe, expect, it } from 'vitest'
import { createGame, fanFavorites, reactionTotals, reduce, songReactionTotal } from './engine'
import { drainTally, tallyReaction, type TallyBuffer } from './reaction-tally'
import type { Action, GameState, Player } from './types'

const player = (id: string): Player => ({ id, name: id, color: '#fff' })
const rx = (playerId: string, emoji: string, owner = 'b', roundId = 'r1') => ({ id: Math.random().toString(), emoji, playerId, owner, roundId })

describe('Fan favorite tally (host device)', () => {
  it('counts reactions toward the song that was playing, per emoji, ignoring your own song', () => {
    const buf: TallyBuffer = new Map()
    tallyReaction(buf, rx('a', '🔥'))
    tallyReaction(buf, rx('a', '🔥'))
    tallyReaction(buf, rx('c', '❤️'))
    tallyReaction(buf, rx('b', '🔥')) // b reacting to b's own song: ignored
    tallyReaction(buf, { id: 'x', emoji: '🔥', playerId: 'a' }) // not during a song: ignored
    expect(drainTally(buf)).toEqual([{ type: 'reactions', roundId: 'r1', owner: 'b', counts: { '🔥': 2, '❤️': 1 } }])
    expect(buf.size).toBe(0)
  })
})

describe('reactions in the game rules', () => {
  // a hosts; b and c play; one round where everyone picked
  function game(): GameState {
    let s = createGame(player('a'), 'ABCD', 1)
    for (const id of ['b', 'c']) s = reduce(s, { type: 'join', player: player(id) }, id, 1)
    s = reduce(s, { type: 'start' }, 'a', 1)
    s = reduce(s, { type: 'ask', prompt: 'Q' }, 'a', 1)
    for (const id of ['a', 'b', 'c']) s = reduce(s, { type: 'pick', track: { id, title: id, artist: 'x', durationMs: 1000, source: 'demo' } }, id, 1)
    return s
  }
  const rid = (s: GameState) => s.rounds[0].id

  it('adds counts up, keeps only real reaction emojis, and only the host records them', () => {
    let s = game()
    const add = (counts: Record<string, number>): Action => ({ type: 'reactions', roundId: rid(s), owner: 'b', counts })
    s = reduce(s, add({ '🔥': 5, '❤️': 1 }), 'a')
    s = reduce(s, add({ '🔥': 3, '💩': 99, '😂': -4 }), 'a')
    expect(s.rounds[0].reactions!.b).toEqual({ '🔥': 8, '❤️': 1 })
    expect(songReactionTotal(s.rounds[0], 'b')).toBe(9)
    expect(() => reduce(s, add({ '🔥': 1 }), 'b')).toThrow(/host/)
  })

  it('finds the fan favorite and their most-used emoji (ties share it)', () => {
    let s = game()
    s = reduce(s, { type: 'reactions', roundId: rid(s), owner: 'b', counts: { '🔥': 6, '❤️': 2 } }, 'a')
    s = reduce(s, { type: 'reactions', roundId: rid(s), owner: 'c', counts: { '😭': 3 } }, 'a')
    expect(reactionTotals(s)).toEqual({ b: { total: 8, top: '🔥' }, c: { total: 3, top: '😭' } })
    expect(fanFavorites(s)).toEqual(['b'])
    s = reduce(s, { type: 'reactions', roundId: rid(s), owner: 'c', counts: { '😭': 5 } }, 'a')
    expect(fanFavorites(s).sort()).toEqual(['b', 'c'])
    expect(fanFavorites(game())).toEqual([])
  })
})
