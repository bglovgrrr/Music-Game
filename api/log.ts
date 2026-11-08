/**
 * POST /api/log
 *
 * Error reports from the app (and the browser's Content Security Policy reports), written to
 * Vercel's runtime logs so problems on real phones show up without a third-party service.
 * Reports never include names, songs or anything people typed (see src/lib/report.ts).
 */
import { cleanReport } from '../src/server/log.js'

const recent = new Map<string, { n: number; at: number }>() // best-effort, per warm instance

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method !== 'POST') return new Response(null, { status: 405 })
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const now = Date.now()
    const r = recent.get(ip)
    if (r && now - r.at < 60_000) {
      if (++r.n > 30) return new Response(null, { status: 429 })
    } else recent.set(ip, { n: 1, at: now })

    const text = await req.text()
    if (text.length > 16_000) return new Response(null, { status: 413 })
    let parsed: unknown = null
    try {
      parsed = JSON.parse(text)
    } catch {
      return new Response(null, { status: 400 })
    }
    const items = Array.isArray(parsed) ? parsed.slice(0, 10) : [parsed]
    for (const item of items) {
      const report = cleanReport(item)
      if (report) console.error(`[client ${report.kind}] ${report.message}`, JSON.stringify(report))
    }
    return new Response(null, { status: 204 })
  },
}
