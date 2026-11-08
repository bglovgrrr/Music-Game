import { fanFavorites, reactionTotals, voteResults } from '@/game/engine'
import type { GameClient } from '@/game/client'
import { inkColor } from '@/game/colors'
import type { GameState } from '@/game/types'
import { spotifySearchUrl } from '@/music/search'
import { supabase } from './supabase'

/**
 * A "wrap": the public, read-only snapshot of a finished game behind a share link
 * (/w/<id>). Deliberately leaves out selfies, "why I picked it" notes and player ids.
 */
export type WrapSnapshot = {
  v: 1
  date: number
  players: { name: string; color: string }[]
  rounds: {
    prompt: string
    themeId?: string
    asker?: string
    songs: { title: string; artist: string; artwork?: string; url: string; by: string; color: string; crowned: boolean }[]
  }[]
  fanFavorite?: { names: string[]; total: number; top?: string }
}

export function buildSnapshot(s: GameState): WrapSnapshot {
  const name = (id: string) => s.players.find((p) => p.id === id)?.name ?? '?'
  const color = (id: string) => inkColor(s.players.find((p) => p.id === id)?.color)
  const favs = fanFavorites(s)
  const rx = reactionTotals(s)
  return {
    v: 1,
    date: s.createdAt,
    players: s.players.map((p) => ({ name: p.name, color: inkColor(p.color) })),
    rounds: s.rounds
      .filter((r) => r.order.length > 0)
      .map((r) => {
        const { winners } = voteResults(r)
        return {
          prompt: r.prompt,
          themeId: r.themeId,
          asker: name(r.askerId),
          songs: r.order.map((pid) => {
            const t = r.picks.find((p) => p.playerId === pid)!.track
            return {
              title: t.title,
              artist: t.artist,
              artwork: t.artwork,
              url: t.source === 'spotify' && t.externalUrl ? t.externalUrl : spotifySearchUrl(t),
              by: name(pid),
              color: color(pid),
              crowned: winners.includes(pid),
            }
          }),
        }
      }),
    fanFavorite: favs.length ? { names: favs.map(name), total: rx[favs[0]].total, top: rx[favs[0]].top } : undefined,
  }
}

/** Only online games can be shared as a link (demo games aren't saved anywhere). */
export function canShareWrap(client: GameClient) {
  return !!supabase && client.mode === 'online' && 'roomId' in client
}

/** Saves (or refreshes) this game's wrap and its preview image; returns the share link. */
export async function shareWrap(client: GameClient, s: GameState, card: Blob): Promise<string> {
  if (!supabase || !canShareWrap(client)) throw new Error('Sharing a link needs an online game.')
  const room = (client as unknown as { roomId: string }).roomId
  const { data: id, error } = await supabase.rpc('create_share', { room, snap: buildSnapshot(s) })
  if (error || typeof id !== 'string') throw new Error(error?.message || 'Could not create the link')
  const up = await supabase.storage.from('wraps').upload(`${id}.png`, card, { upsert: true, contentType: 'image/png', cacheControl: '300' })
  if (up.error) console.warn('wrap image upload failed', up.error.message) // the link still works without the preview image
  return `${window.location.origin}/w/${id}`
}

export async function loadWrap(id: string): Promise<WrapSnapshot | null> {
  if (!supabase || !/^[A-Za-z0-9]{10}$/.test(id)) return null
  const { data, error } = await supabase.rpc('get_share', { share_id: id })
  if (error) throw new Error(error.message)
  return (data as WrapSnapshot | null) ?? null
}

/** The wrap id in the current address: /w/<id> or ?wrap=<id>. */
export function wrapIdFromLocation(): string | null {
  try {
    const m = window.location.pathname.match(/^\/w\/([A-Za-z0-9]{10})\/?$/)
    if (m) return m[1]
    const q = new URLSearchParams(window.location.search).get('wrap')
    return q && /^[A-Za-z0-9]{10}$/.test(q) ? q : null
  } catch {
    return null
  }
}
