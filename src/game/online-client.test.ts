import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameState, Track } from './types'

/**
 * Tests the online sync against a small in-memory stand-in for Supabase that behaves
 * like the real database: versioned updates, create/join functions, realtime broadcasts,
 * and network delay so two phones can genuinely collide.
 */

const fake = vi.hoisted(() => {
  const db = {
    row: null as null | { id: string; code: string; state: GameState; version: number },
    currentUser: '',
    listeners: [] as ((payload: { new: unknown }) => void)[],
    broadcasts: [] as { ch: object; cb: (m: { payload: unknown }) => void }[],
    updates: 0,
    conflicts: 0,
  }
  const delay = () => new Promise((r) => setTimeout(r, 5 + Math.random() * 10))
  const copy = <T>(v: T): T => structuredClone(v)
  const broadcast = () => {
    const snapshot = copy(db.row)
    for (const l of db.listeners) setTimeout(() => l({ new: snapshot }), 1)
  }

  const supabase = {
    rpc: async (fn: string, args: Record<string, string>) => {
      await delay()
      const uid = db.currentUser
      if (fn === 'server_time') return { data: new Date().toISOString(), error: null }
      if (fn === 'create_room') {
        const now = Date.now()
        db.row = {
          id: 'room-1',
          code: 'TEST',
          version: 1,
          state: {
            id: 'g1', code: 'TEST', hostId: uid, phase: 'lobby', turn: 0, rounds: [], createdAt: now,
            players: [{ id: uid, name: args.player_name, color: '#cfcaff' }],
            playback: { isPlaying: false, positionMs: 0, updatedAt: now },
          },
        }
        return { data: copy(db.row), error: null }
      }
      if (fn === 'join_room') {
        if (!db.row || db.row.code !== args.room_code.toUpperCase()) return { data: null, error: { message: `No game found with code ${args.room_code}` } }
        if (!db.row.state.players.some((p) => p.id === uid)) {
          db.row.state.players.push({ id: uid, name: args.player_name, color: '#ffc4da' })
          db.row.version++
          broadcast()
        }
        return { data: copy(db.row), error: null }
      }
      throw new Error(`unknown rpc ${fn}`)
    },

    from: () => {
      const filters: Record<string, unknown> = {}
      let patch: { state: GameState; version: number } | null = null
      const builder = {
        select: () => builder,
        update: (p: { state: GameState; version: number }) => ((patch = p), builder),
        eq: (col: string, val: unknown) => ((filters[col] = val), builder),
        maybeSingle: async () => {
          await delay()
          if (!db.row || filters.id !== db.row.id) return { data: null, error: null }
          if (!patch) return { data: copy(db.row), error: null }
          if (filters.version !== db.row.version) {
            db.conflicts++
            return { data: null, error: null } // version check failed: 0 rows
          }
          db.row = { ...db.row, state: copy(patch.state), version: patch.version }
          db.updates++
          broadcast()
          return { data: copy(db.row), error: null }
        },
      }
      return builder
    },

    channel: () => {
      const ch = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        on: (type: string, _f: unknown, cb: (p: any) => void) => {
          if (type === 'broadcast') db.broadcasts.push({ ch, cb })
          else db.listeners.push(cb)
          return ch
        },
        subscribe: (cb: (s: string) => void) => (setTimeout(() => cb('SUBSCRIBED'), 1), ch),
        // Like Supabase's default: a broadcast reaches everyone except the sender.
        send: async (m: { payload: unknown }) => {
          for (const b of db.broadcasts) if (b.ch !== ch) setTimeout(() => b.cb({ payload: m.payload }), 1)
          return 'ok'
        },
      }
      return ch
    },
    removeChannel: async () => {},
    auth: { getSession: async () => ({ data: { session: { user: { id: db.currentUser } } } }) },
  }
  return { db, supabase }
})

vi.mock('@/lib/supabase', () => ({
  supabase: fake.supabase,
  onlineAvailable: true,
  OnlineError: class OnlineError extends Error {},
  ensureSession: async () => fake.db.currentUser,
  syncClock: async () => {},
  friendlyError: (e: { message?: string }) => e?.message ?? String(e),
}))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))

const { OnlineGameClient } = await import('./online-client')
const { currentRound } = await import('./engine')

const track = (id: string): Track => ({ id, title: id, artist: 'x', durationMs: 30_000, source: 'demo' })
const settle = () => new Promise((r) => setTimeout(r, 120))

async function as<T>(uid: string, fn: () => Promise<T>) {
  fake.db.currentUser = uid
  return fn()
}

beforeEach(() => {
  ;(globalThis as { document?: unknown }).document = { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' }
  Object.assign(fake.db, { row: null, listeners: [], broadcasts: [], updates: 0, conflicts: 0 })
})
afterEach(() => {
  delete (globalThis as { document?: unknown }).document
})

describe('online game sync', () => {
  it('a friend joining shows up on the host phone', async () => {
    const host = await as('u-host', () => OnlineGameClient.create('Brian'))
    const friend = await as('u-friend', () => OnlineGameClient.join('test', 'Maya'))
    await settle()
    expect(host.getState().players.map((p) => p.name)).toEqual(['Brian', 'Maya'])
    expect(friend.getState().players.map((p) => p.name)).toEqual(['Brian', 'Maya'])
    expect(friend.isSpeaker).toBe(false)
    expect(host.isSpeaker).toBe(true)
  })

  it('a wrong code gives a clear error', async () => {
    await as('u-host', () => OnlineGameClient.create('Brian'))
    await expect(as('u-x', () => OnlineGameClient.join('NOPE', 'X'))).rejects.toThrow(/No game found/)
  })

  it('two players picking at the same moment both count (no lost update)', async () => {
    const host = await as('u-host', () => OnlineGameClient.create('Brian'))
    const friend = await as('u-friend', () => OnlineGameClient.join('TEST', 'Maya'))
    const third = await as('u-third', () => OnlineGameClient.join('TEST', 'Theo'))
    await settle()
    host.dispatch({ type: 'start' })
    await settle()
    host.dispatch({ type: 'ask', prompt: 'A song for a rainy day' })
    await settle()

    friend.dispatch({ type: 'pick', track: track('friend-song') })
    third.dispatch({ type: 'pick', track: track('third-song') })
    await settle()

    const picks = currentRound(fake.db.row!.state)!.picks.map((p) => p.track.id).sort()
    expect(picks).toEqual(['friend-song', 'third-song'])
    expect(fake.db.conflicts).toBeGreaterThan(0) // the two saves really collided
    for (const c of [host, friend, third]) expect(currentRound(c.getState())!.picks).toHaveLength(2)
  })

  it('everyone pressing Next together skips exactly one song', async () => {
    const host = await as('u-host', () => OnlineGameClient.create('Brian'))
    const friend = await as('u-friend', () => OnlineGameClient.join('TEST', 'Maya'))
    await settle()
    host.dispatch({ type: 'start' })
    await settle()
    host.dispatch({ type: 'ask', prompt: 'Q' })
    await settle()
    host.dispatch({ type: 'pick', track: track('a') })
    await settle()
    friend.dispatch({ type: 'pick', track: track('b') })
    await settle()
    expect(fake.db.row!.state.phase).toBe('listening')

    host.dispatch({ type: 'next', from: 0 })
    friend.dispatch({ type: 'next', from: 0 })
    await settle()
    expect(currentRound(fake.db.row!.state)!.current).toBe(1)
    expect(fake.db.row!.state.phase).toBe('listening')
    expect(currentRound(friend.getState())!.current).toBe(1)
  })

  it('pausing on one phone pauses on every phone', async () => {
    const host = await as('u-host', () => OnlineGameClient.create('Brian'))
    const friend = await as('u-friend', () => OnlineGameClient.join('TEST', 'Maya'))
    await settle()
    host.dispatch({ type: 'start' })
    await settle()
    host.dispatch({ type: 'ask', prompt: 'Q' })
    await settle()
    host.dispatch({ type: 'pick', track: track('a') })
    friend.dispatch({ type: 'pick', track: track('b') })
    await settle()
    friend.dispatch({ type: 'play' })
    await settle()
    expect(host.getState().playback.isPlaying).toBe(true)
    host.dispatch({ type: 'pause' })
    await settle()
    expect(friend.getState().playback.isPlaying).toBe(false)
  })

  it('shows your own tap instantly, before the server answers', async () => {
    const host = await as('u-host', () => OnlineGameClient.create('Brian'))
    await as('u-friend', () => OnlineGameClient.join('TEST', 'Maya'))
    await settle()
    host.dispatch({ type: 'start' })
    expect(host.getState().phase).toBe('asking') // optimistic
    expect(fake.db.row!.state.phase).toBe('lobby') // not saved yet
    await settle()
    expect(fake.db.row!.state.phase).toBe('asking')
  })

  it('a reaction shows on every phone (once), without touching the database', async () => {
    const host = await as('u-host', () => OnlineGameClient.create('Brian'))
    const friend = await as('u-friend', () => OnlineGameClient.join('TEST', 'Maya'))
    await settle()
    const seenByHost: string[] = []
    const seenByFriend: string[] = []
    host.onReaction((r) => seenByHost.push(r.emoji))
    friend.onReaction((r) => seenByFriend.push(r.emoji))
    const updatesBefore = fake.db.updates
    friend.react('🔥')
    await settle()
    expect(seenByHost).toEqual(['🔥'])
    expect(seenByFriend).toEqual(['🔥'])
    expect(fake.db.updates).toBe(updatesBefore)
  })

  it('an invalid tap is rejected locally and never sent', async () => {
    await as('u-host', () => OnlineGameClient.create('Brian'))
    const friend = await as('u-friend', () => OnlineGameClient.join('TEST', 'Maya'))
    await settle()
    const before = fake.db.updates
    expect(() => friend.dispatch({ type: 'start' })).toThrow(/host/)
    await settle()
    expect(fake.db.updates).toBe(before)
  })
})
