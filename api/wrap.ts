/**
 * GET /w/<id>  (rewritten to /api/wrap?id=<id> in vercel.json)
 *
 * The share link for a finished game. Chat apps (iMessage, WhatsApp, Slack…) read the
 * Open Graph tags for a rich preview: the recap card image and a title. People are sent
 * straight on to the app's wrap screen. The Supabase URL and publishable key are public
 * (the same ones the app ships with); the snapshot is read through get_share().
 */
import { wrapPage, type WrapMeta } from '../src/server/wrap-page.js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://iizvvvzccqttwlvqkfzi.supabase.co'
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Qjh4wnV1MO63HQVudm22Ww_xjFvnVNc'

export default {
  async fetch(req: Request): Promise<Response> {
    const u = new URL(req.url)
    const id = u.searchParams.get('id') ?? u.pathname.split('/').pop() ?? ''
    const html = (body: string, status = 200, cache = 'public, s-maxage=300, stale-while-revalidate=86400') =>
      new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache } })

    if (!/^[A-Za-z0-9]{10}$/.test(id)) return html('<meta http-equiv="refresh" content="0; url=/" />', 404, 'no-store')

    let wrap: WrapMeta | null = null
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_share`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ share_id: id }),
      })
      if (res.ok) wrap = (await res.json()) as WrapMeta | null
    } catch {
      /* fall through: still send people to the app */
    }
    const image = `${SUPABASE_URL}/storage/v1/object/public/wraps/${id}.png`
    return html(wrapPage({ id, origin: u.origin, image, wrap }), wrap ? 200 : 404, wrap ? undefined : 'no-store')
  },
}
