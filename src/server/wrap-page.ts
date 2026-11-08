/**
 * Builds the tiny HTML page served at /w/<id>: Open Graph / Twitter tags so chat apps show a
 * rich preview (the recap card + a title), then it sends people on to the app's wrap screen.
 */

export type WrapMeta = {
  date: number
  players: { name: string }[]
  rounds: { prompt: string; songs: unknown[] }[]
  fanFavorite?: { names: string[]; total: number; top?: string }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function wrapTitle(w: WrapMeta) {
  const date = new Date(w.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const songs = w.rounds.reduce((n, r) => n + r.songs.length, 0)
  return `${date} mixtape · ${w.players.length} friends · ${songs} songs`
}

export function wrapDescription(w: WrapMeta) {
  const parts: string[] = []
  if (w.fanFavorite) parts.push(`Fan favorite: ${w.fanFavorite.names.join(' & ')}${w.fanFavorite.top ? ` ${w.fanFavorite.top}` : ''}`)
  const qs = w.rounds.slice(0, 3).map((r) => `“${r.prompt}”`)
  if (qs.length) parts.push(qs.join(' · '))
  parts.push('Tap to hear every song.')
  return parts.join(' — ')
}

export function wrapPage({ id, origin, image, wrap }: { id: string; origin: string; image: string; wrap: WrapMeta | null }) {
  const target = `/?wrap=${id}`
  const title = wrap ? wrapTitle(wrap) : 'Mixtape Memories'
  const desc = wrap ? wrapDescription(wrap) : 'A music storytelling game for friends in one room.'
  const url = `${origin}/w/${id}`
  const og = wrap
    ? `
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:width" content="1080" />
<meta property="og:image:height" content="1350" />
<meta property="og:image:alt" content="${esc(title)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${esc(image)}" />`
    : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Mixtape Memories" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${esc(url)}" />${og}
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="theme-color" content="#1a100b" />
<meta http-equiv="refresh" content="0; url=${esc(target)}" />
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#1a100b;color:#f3e7da;font:16px system-ui,sans-serif}a{color:#f4a949}</style>
</head>
<body>
<p><a href="${esc(target)}">Open the mixtape</a></p>
<script>location.replace(${JSON.stringify(target)})</script>
</body>
</html>`
}
