/**
 * room-action: the only way a game changes once it's online.
 *
 * A phone sends one move ({ roomId, action }). This checks the player is signed in and in that
 * game, applies the same rules as the app (./game, generated from src/game), and saves the
 * result with a version check, retrying if someone else saved first. Phones can read rooms but
 * can't write them directly (see the room_actions_server_side migration).
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { GameError, reduce } from './game/engine.ts'
import type { Action, GameState } from './game/types.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type RoomRow = { id: string; code: string; state: GameState; version: number }
const COLUMNS = 'id, code, state, version'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await admin.auth.getUser(jwt)
  const uid = auth.user?.id
  if (!uid) return json({ error: 'Not signed in' }, 401)

  const text = await req.text()
  if (text.length > 20_000) return json({ error: 'That move is too big.' }, 413)
  let body: { roomId?: unknown; action?: Partial<Action> & { type?: unknown; path?: unknown } }
  try {
    body = JSON.parse(text)
  } catch {
    return json({ error: 'Bad request' }, 400)
  }
  const roomId = body.roomId
  const action = body.action
  if (typeof roomId !== 'string' || !action || typeof action.type !== 'string') return json({ error: 'Bad request' }, 400)
  // Online, players join only through the room code (join_room), never by sending a move.
  if (action.type === 'join') return json({ error: 'Join with the room code.' }, 400)
  // A selfie must be a file in this game's own folder.
  if (action.type === 'photo' && (typeof action.path !== 'string' || !action.path.startsWith(`${roomId}/`))) {
    return json({ error: 'That photo isn’t from this game.' }, 400)
  }

  const { data: member } = await admin.from('room_members').select('user_id').eq('room_id', roomId).eq('user_id', uid).maybeSingle()
  if (!member) return json({ error: 'You’re not in this game.' }, 403)

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: row } = await admin.from('rooms').select(COLUMNS).eq('id', roomId).maybeSingle<RoomRow>()
    if (!row) return json({ error: 'Game not found.' }, 404)
    let next: GameState
    try {
      next = reduce(row.state, action as Action, uid, Date.now())
    } catch (err) {
      // Not allowed (or overtaken by someone else's move): tell the phone, with the latest state.
      if (err instanceof GameError) return json({ error: err.message, rejected: true, row }, 409)
      throw err
    }
    if (next === row.state) return json({ row })
    const { data: saved } = await admin
      .from('rooms')
      .update({ state: next, version: row.version + 1, updated_at: new Date().toISOString() })
      .eq('id', roomId)
      .eq('version', row.version)
      .select(COLUMNS)
      .maybeSingle<RoomRow>()
    if (saved) return json({ row: saved })
    // someone else saved first: try again on top of theirs
  }
  return json({ error: 'The game is busy. Try again.' }, 503)
})
