import { describe, expect, it } from 'vitest'
import { createGame, reduce } from '@/game/engine'
import type { GameState, Player } from '@/game/types'
import { wrapDescription, wrapPage, wrapTitle } from '@/server/wrap-page'
import { buildSnapshot } from './wrap'

const player = (id: string): Player => ({ id, name: id.toUpperCase(), color: '#cfcaff' })

function finishedGame(): GameState {
  let s = createGame(player('a'), 'ABCD', 1)
  for (const id of ['b', 'c']) s = reduce(s, { type: 'join', player: player(id) }, id, 1)
  s = reduce(s, { type: 'start' }, 'a', 1)
  s = reduce(s, { type: 'ask', prompt: 'A song for a rainy day', themeId: 'places' }, 'a', 1)
  for (const id of ['a', 'b', 'c'])
    s = reduce(s, { type: 'pick', track: { id, title: `Song ${id}`, artist: 'Artist', durationMs: 1000, source: 'demo' }, note: `secret note from ${id}` }, id, 1)
  s = reduce(s, { type: 'photo', roundId: s.rounds[0].id, path: 'room/selfie.jpg' }, 'a', 1)
  return s
}

describe('wrap snapshot (the public share)', () => {
  it('keeps the songs and who picked them, and leaves out notes, selfies and player ids', () => {
    const snap = buildSnapshot(finishedGame())
    const json = JSON.stringify(snap)
    expect(snap.players.map((p) => p.name)).toEqual(['A', 'B', 'C'])
    expect(snap.rounds[0]).toMatchObject({ prompt: 'A song for a rainy day', themeId: 'places', asker: 'A' })
    expect(snap.rounds[0].songs.map((s) => s.by).sort()).toEqual(['A', 'B', 'C'])
    expect(snap.rounds[0].songs.every((s) => s.url.startsWith('https://open.spotify.com/search/'))).toBe(true)
    expect(json).not.toContain('secret note')
    expect(json).not.toContain('selfie')
    expect(json).not.toMatch(/"id"|"playerId"/)
  })
})

describe('share link page (Open Graph)', () => {
  const wrap = {
    date: Date.UTC(2026, 10, 8),
    players: [{ name: 'A' }, { name: 'B' }],
    rounds: [{ prompt: 'Songs <for> "rain"', songs: [1, 2] }],
    fanFavorite: { names: ['Maya'], total: 12, top: '🔥' },
  }

  it('has a title, description and the card as the preview image', () => {
    const html = wrapPage({ id: 'abcdEFGH23', origin: 'https://example.app', image: 'https://cdn/x.png', wrap })
    expect(wrapTitle(wrap)).toBe('Nov 8 mixtape · 2 friends · 2 songs')
    expect(wrapDescription(wrap)).toContain('Fan favorite: Maya 🔥')
    expect(html).toContain('<meta property="og:image" content="https://cdn/x.png" />')
    expect(html).toContain('<meta property="og:url" content="https://example.app/w/abcdEFGH23" />')
    expect(html).toContain('summary_large_image')
    expect(html).toContain('location.replace("/?wrap=abcdEFGH23")')
  })

  it('escapes what people typed', () => {
    const html = wrapPage({ id: 'abcdEFGH23', origin: 'https://example.app', image: 'x', wrap })
    expect(html).not.toContain('<for>')
    expect(html).toContain('Songs &lt;for&gt; &quot;rain&quot;')
  })

  it('still sends people to the app (without a preview image) when the share is missing', () => {
    const html = wrapPage({ id: 'abcdEFGH23', origin: 'https://example.app', image: 'x', wrap: null })
    expect(html).not.toContain('og:image')
    expect(html).toContain('/?wrap=abcdEFGH23')
  })
})
