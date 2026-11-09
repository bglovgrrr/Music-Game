/**
 * cleanup: deletes data the privacy page says we don't keep. Run daily by pg_cron.
 * - Games (and their selfies, notes, members) 30 days after they started.
 * - Share-link snapshots and their preview images a year after they were made.
 * Takes no input and only ever removes expired data, so it's safe to call any time.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

const GAME_DAYS = 30
const SHARE_DAYS = 365
const BATCH = 100

Deno.serve(async () => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
  let games = 0
  let photos = 0
  let shares = 0

  // Old games: remove their selfie files first (storage), then the rows (members cascade;
  // a share made from the game keeps its snapshot, its link to the game is cleared).
  const { data: rooms } = await admin.from('rooms').select('id').lt('created_at', ago(GAME_DAYS)).limit(BATCH)
  for (const { id } of rooms ?? []) {
    const { data: files } = await admin.storage.from('selfies').list(id, { limit: 100 })
    if (files?.length) {
      await admin.storage.from('selfies').remove(files.map((f) => `${id}/${f.name}`))
      photos += files.length
    }
    const { error } = await admin.from('rooms').delete().eq('id', id)
    if (!error) games++
  }

  // Old share links: the preview image and the snapshot.
  const { data: old } = await admin.from('shares').select('id').lt('created_at', ago(SHARE_DAYS)).limit(BATCH)
  if (old?.length) {
    await admin.storage.from('wraps').remove(old.map((s) => `${s.id}.png`))
    const { error } = await admin.from('shares').delete().in('id', old.map((s) => s.id))
    if (!error) shares = old.length
  }

  const result = { games, photos, shares, more: (rooms?.length ?? 0) === BATCH || (old?.length ?? 0) === BATCH }
  console.log('cleanup', JSON.stringify(result))
  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
})
