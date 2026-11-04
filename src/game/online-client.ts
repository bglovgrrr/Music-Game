import type { RealtimeChannel } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { clock } from '@/lib/clock'
import { ensureSession, friendlyError, OnlineError, supabase, syncClock } from '@/lib/supabase'
import { safeStorage } from '@/lib/utils'
import type { GameClient, Reaction } from './client'
import { currentRound, GameError, reduce } from './engine'
import type { Action, GameState } from './types'

type RoomRow = { id: string; code: string; state: GameState; version: number }

const ROOM_KEY = 'sideb:room'

/**
 * Online game. Every phone runs the same rules (engine.ts) locally, then saves the new
 * state to Supabase with a version check. If two phones act at once, the loser re-reads
 * and re-applies its action. Changes reach everyone through Supabase Realtime.
 */
export class OnlineGameClient implements GameClient {
  readonly mode = 'online' as const
  readonly meId: string
  readonly roomId: string
  private confirmed: RoomRow
  private shown: GameState
  private pending = 0
  private queue: Promise<void> = Promise.resolve()
  private listeners = new Set<() => void>()
  private reactionListeners = new Set<(r: Reaction) => void>()
  private channel: RealtimeChannel | null = null
  private disposed = false

  /** The host's device plays the music. */
  get isSpeaker() {
    return this.shown.hostId === this.meId
  }

  private constructor(meId: string, row: RoomRow) {
    this.meId = meId
    this.roomId = row.id
    this.confirmed = row
    this.shown = row.state
    safeStorage.set(ROOM_KEY, row.id)
    this.listen()
    document.addEventListener('visibilitychange', this.onVisible)
  }

  static async create(name: string) {
    const uid = await ensureSession()
    await syncClock()
    const { data, error } = await supabase!.rpc('create_room', { player_name: name })
    if (error) throw new OnlineError(friendlyError(error))
    return new OnlineGameClient(uid, data as RoomRow)
  }

  static async join(code: string, name: string) {
    const uid = await ensureSession()
    await syncClock()
    const { data, error } = await supabase!.rpc('join_room', { room_code: code, player_name: name })
    if (error) throw new OnlineError(friendlyError(error))
    return new OnlineGameClient(uid, data as RoomRow)
  }

  /** Reopen the last room on this device (after a refresh or reopening the app). */
  static async resume(): Promise<OnlineGameClient | null> {
    const roomId = safeStorage.get(ROOM_KEY)
    if (!supabase || !roomId) return null
    const { data: session } = await supabase.auth.getSession()
    const uid = session.session?.user.id
    if (!uid) return null
    const { data } = await supabase.from('rooms').select('id, code, state, version').eq('id', roomId).maybeSingle()
    const row = data as RoomRow | null
    if (!row || row.state.phase === 'recap' || !row.state.players.some((p) => p.id === uid)) {
      OnlineGameClient.forget()
      return null
    }
    await syncClock()
    return new OnlineGameClient(uid, row)
  }

  static forget() {
    safeStorage.set(ROOM_KEY, '')
  }

  getState = () => this.shown

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispatch = (action: Action) => {
    // Apply right away so the UI feels instant (throws GameError for invalid moves).
    this.show(reduce(this.shown, action, this.meId, clock.now()))
    this.pending++
    this.queue = this.queue.then(() => this.save(action)).finally(() => {
      this.pending--
      if (this.pending === 0) this.show(this.confirmed.state)
    })
  }

  react = (emoji: string) => {
    const round = currentRound(this.shown)
    const r: Reaction = {
      id: `${this.meId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      emoji,
      playerId: this.meId,
      roundId: round?.id,
      owner: this.shown.phase === 'listening' ? round?.order[round.current] : undefined,
    }
    this.reactionListeners.forEach((l) => l(r)) // show my own instantly
    void this.channel?.send({ type: 'broadcast', event: 'reaction', payload: r })
  }

  /** Upload to the private "selfies" bucket under this room's folder. */
  uploadPhoto = async (image: Blob) => {
    const path = `${this.roomId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
    const { error } = await supabase!.storage.from('selfies').upload(path, image, { contentType: 'image/jpeg', upsert: false })
    if (error) throw new OnlineError(friendlyError(error))
    return path
  }

  photoUrl = async (path: string) => {
    const { data, error } = await supabase!.storage.from('selfies').createSignedUrl(path, 60 * 60)
    if (error || !data) throw new OnlineError(friendlyError(error))
    return data.signedUrl
  }

  deletePhoto = async (path: string) => {
    await supabase!.storage.from('selfies').remove([path])
  }

  onReaction = (listener: (r: Reaction) => void) => {
    this.reactionListeners.add(listener)
    return () => this.reactionListeners.delete(listener)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    document.removeEventListener('visibilitychange', this.onVisible)
    const channel = this.channel
    void this.queue.finally(() => {
      if (channel) void supabase!.removeChannel(channel)
    })
    this.listeners.clear()
    this.reactionListeners.clear()
  }

  // ---- internals ----

  private show(state: GameState) {
    this.shown = state
    if (!this.disposed) this.listeners.forEach((l) => l())
  }

  private accept(row: RoomRow) {
    if (row.version <= this.confirmed.version) return
    this.confirmed = row
    if (this.pending === 0) this.show(row.state)
  }

  /** Save one action with a version check; on conflict, re-read and try again. */
  private async save(action: Action) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const base = this.confirmed
      let next: GameState
      try {
        next = reduce(base.state, action, this.meId, clock.now())
      } catch (err) {
        // Someone else's move made ours invalid (e.g. two people pressed "next").
        if (!(err instanceof GameError)) console.error(err)
        return
      }
      if (next === base.state) return
      const { data, error } = await supabase!
        .from('rooms')
        .update({ state: next, version: base.version + 1, updated_at: new Date().toISOString() })
        .eq('id', this.roomId)
        .eq('version', base.version)
        .select('id, code, state, version')
        .maybeSingle()
      if (error) {
        toast.error(friendlyError(error))
        return
      }
      if (data) {
        this.accept(data as RoomRow)
        return
      }
      await this.refresh() // someone else saved first
    }
    toast.error('Could not save that move. Try again.')
  }

  private async refresh() {
    const { data } = await supabase!.from('rooms').select('id, code, state, version').eq('id', this.roomId).maybeSingle()
    if (data) this.accept(data as RoomRow)
  }

  private listen() {
    this.channel = supabase!
      .channel(`room:${this.roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${this.roomId}` }, (payload) =>
        this.accept(payload.new as RoomRow),
      )
      // Reactions travel over a live broadcast only; they are never saved.
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        const r = payload as Reaction
        if (r && typeof r.emoji === 'string' && r.emoji.length <= 8) this.reactionListeners.forEach((l) => l(r))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void this.refresh() // catch anything missed while connecting
      })
  }

  private onVisible = () => {
    if (document.visibilityState === 'visible') {
      void syncClock()
      void this.refresh()
    }
  }
}
