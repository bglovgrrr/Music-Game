import { inkColor } from '@/game/colors'
import { fanFavorites, playerById, reactionTotals, scores, voteResults } from '@/game/engine'
import { themeName } from '@/game/prompts'
import type { GameState } from '@/game/types'

/** Draws a 1080×1350 image of the night's mixtape (good for Instagram / Messages). */
export async function drawRecapCard(s: GameState, photoUrl?: string | null): Promise<Blob> {
  if (photoUrl) {
    try {
      return await drawCard(s, await loadImage(photoUrl))
    } catch {
      /* photo couldn't be drawn (e.g. blocked by the browser); make the card without it */
    }
  }
  return drawCard(s, null)
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load photo'))
    img.src = url
  })
}

async function drawCard(s: GameState, photo: HTMLImageElement | null): Promise<Blob> {
  const W = 1080
  const H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')!

  try {
    await Promise.all([
      document.fonts.load('800 120px "Bricolage Grotesque"'),
      document.fonts.load('italic 400 64px "Instrument Serif"'),
      document.fonts.load('600 32px Geist'),
      document.fonts.load('400 32px Geist'),
      document.fonts.load('500 24px "Geist Mono"'),
    ])
  } catch {
    /* fall back to system fonts */
  }

  // Colours: paper and ink (same as the app's paper material), lamp amber, neon.
  const PAPER = '#efe4d1'
  const INK = '#2a1e18'
  const MUTED = 'rgba(42,30,24,0.6)'
  const AMBER = '#a0560b'
  const NEON = '#c2185b'
  const display = (size: number) => `800 ${size}px "Bricolage Grotesque", Impact, sans-serif`
  const note = (size: number) => `italic 400 ${size}px "Instrument Serif", Georgia, serif`
  const sans = (size: number, weight = 400) => `${weight} ${size}px Geist, system-ui, sans-serif`
  const mono = (size: number, weight = 500) => `${weight} ${size}px "Geist Mono", ui-monospace, monospace`
  const condensed = (on: boolean) => {
    ;(c as CanvasRenderingContext2D & { fontStretch?: string }).fontStretch = on ? 'condensed' : 'normal'
  }
  const spaced = (text: string, x: number, y: number, spacing: number) => {
    // letter-spaced caps (canvas letterSpacing isn't everywhere yet)
    let cx = x
    for (const ch of text) {
      c.fillText(ch, cx, y)
      cx += c.measureText(ch).width + spacing
    }
    return cx - x
  }
  const spacedWidth = (text: string, spacing: number) => [...text].reduce((w, ch) => w + c.measureText(ch).width + spacing, 0)

  // A repeatable "random" per game so the wood and tears look the same every time.
  let seed = [...s.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) || 7
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)

  // ---- The coffee table: dark wood, plank seams, neon from above, dark corners ----
  c.fillStyle = '#1a100b'
  c.fillRect(0, 0, W, H)
  for (let i = 0; i < 260; i++) {
    const y = rnd() * H
    c.strokeStyle = rnd() > 0.5 ? `rgba(70,40,24,${0.25 + rnd() * 0.35})` : `rgba(0,0,0,${0.2 + rnd() * 0.3})`
    c.lineWidth = 0.6 + rnd() * 2.4
    c.beginPath()
    c.moveTo(-20, y)
    c.bezierCurveTo(W * 0.3, y + (rnd() - 0.5) * 18, W * 0.7, y + (rnd() - 0.5) * 18, W + 20, y + (rnd() - 0.5) * 10)
    c.stroke()
  }
  for (let y = 210; y < H; y += 230) {
    c.fillStyle = 'rgba(0,0,0,0.55)'
    c.fillRect(0, y, W, 3)
    c.fillStyle = 'rgba(255,255,255,0.05)'
    c.fillRect(0, y + 3, W, 1)
  }
  const glow = (x: number, y: number, r: number, color: string) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    c.fillStyle = g
    c.fillRect(0, 0, W, H)
  }
  glow(W / 2, -220, 1000, 'rgba(255,79,163,0.30)')
  glow(-80, H + 60, 700, 'rgba(255,170,80,0.10)')
  const vig = c.createRadialGradient(W / 2, H * 0.42, H * 0.35, W / 2, H * 0.5, H * 0.85)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.6)')
  c.fillStyle = vig
  c.fillRect(0, 0, W, H)

  // ---- The poster: torn paper, slightly askew, taped to the table ----
  const PX = 72
  const PY = 96
  const PW = W - PX * 2
  const PH = H - PY - 70
  const TILT = -1.2
  c.save()
  c.translate(W / 2, PY + PH / 2)
  c.rotate((TILT * Math.PI) / 180)
  c.translate(-W / 2, -(PY + PH / 2))

  const torn = () => {
    c.beginPath()
    c.moveTo(PX, PY + 6)
    for (let x = PX; x <= PX + PW; x += 14 + rnd() * 10) c.lineTo(x, PY + rnd() * 12)
    c.lineTo(PX + PW, PY + PH - 6)
    for (let x = PX + PW; x >= PX; x -= 14 + rnd() * 10) c.lineTo(x, PY + PH - rnd() * 12)
    c.closePath()
  }
  c.save()
  c.shadowColor = 'rgba(0,0,0,0.65)'
  c.shadowBlur = 40
  c.shadowOffsetY = 18
  c.fillStyle = PAPER
  torn()
  c.fill()
  c.restore()
  // paper fibres
  c.save()
  torn()
  c.clip()
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = `rgba(90,60,30,${rnd() * 0.05})`
    c.fillRect(PX + rnd() * PW, PY + rnd() * PH, 1 + rnd() * 2, 1 + rnd() * 2)
  }
  const shade = c.createLinearGradient(0, PY, 0, PY + PH)
  shade.addColorStop(0, 'rgba(255,200,230,0.10)')
  shade.addColorStop(1, 'rgba(60,30,10,0.08)')
  c.fillStyle = shade
  c.fillRect(PX, PY, PW, PH)
  c.restore()

  const L = PX + 64 // poster content left
  const R = PX + PW - 64 // poster content right
  c.textBaseline = 'alphabetic'

  // Header strip
  drawCassetteMark(c, L + 22, PY + 70, 44, NEON)
  c.fillStyle = INK
  c.font = mono(22, 600)
  spaced('MIXTAPE MEMORIES', L + 58, PY + 78, 5)
  const date = new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
  c.fillStyle = MUTED
  c.font = mono(22)
  spaced(date, R - spacedWidth(date, 4), PY + 78, 4)
  c.fillStyle = INK
  c.fillRect(L, PY + 98, R - L, 3)

  // Headline: "Nov 8 mixtape."
  const titleRight = photo ? R - 300 : R
  const day = new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const nRounds = s.rounds.filter((r) => r.order.length).length
  let size = nRounds >= 3 ? 108 : nRounds === 2 ? 128 : 150
  condensed(true)
  c.font = display(size)
  while (size > 90 && c.measureText(day).width > titleRight - L) c.font = display((size -= 6))
  c.fillStyle = INK
  c.fillText(day, L - 4, PY + 98 + size * 0.95)
  condensed(false)
  c.font = note(size * 0.9)
  c.fillStyle = AMBER
  c.fillText('mixtape.', L, PY + 98 + size * 0.95 + size * 0.82)
  let y = PY + 98 + size * 0.95 + size * 0.82 + 52

  const rounds = s.rounds.filter((r) => r.order.length)
  const songs = rounds.reduce((n, r) => n + r.order.length, 0)
  c.font = mono(22)
  c.fillStyle = MUTED
  spaced(`${s.players.length} FRIENDS · ${rounds.length} ${rounds.length === 1 ? 'QUESTION' : 'QUESTIONS'} · ${songs} SONGS`, L, y, 3)
  y += 40

  // Tracklist: one "side" per question
  const pts = scores(s)
  const guessing = s.rounds.some((r) => r.guessMode)
  const favs = fanFavorites(s)
  const footerH = 156
  const maxY = PY + PH - footerH

  const ellipsize = (text: string, max: number) => {
    if (c.measureText(text).width <= max) return text
    let t = text
    while (t.length > 1 && c.measureText(`${t}…`).width > max) t = t.slice(0, -1)
    return `${t.trimEnd()}…`
  }
  const wrap = (text: string, max: number, lines: number) => {
    const out: string[] = []
    let line = ''
    for (const w of text.split(' ')) {
      const test = line ? `${line} ${w}` : w
      if (c.measureText(test).width > max && line) {
        out.push(line)
        line = w
      } else line = test
    }
    if (line) out.push(line)
    if (out.length > lines) {
      out.length = lines
      out[lines - 1] = ellipsize(`${out[lines - 1]}…`, max)
    }
    return out
  }
  const ROWS = 5
  const blockHeight = (r: (typeof rounds)[number], k: number) => {
    c.font = note(40 * k)
    const lines = wrap(`“${r.prompt}”`, R - L, 2).length
    return (34 + lines * 44 + Math.min(r.order.length, ROWS) * 52 + (r.order.length > ROWS ? 30 : 0) + 34) * k
  }
  const available = maxY - y
  let k = Math.min(1.35, Math.max(0.62, available / Math.max(1, rounds.reduce((h, r) => h + blockHeight(r, 1), 0))))
  while (k > 0.62 && rounds.reduce((h, r) => h + blockHeight(r, k), 0) > available * 0.97) k -= 0.03
  const total = rounds.reduce((h, r) => h + blockHeight(r, k), 0)
  if (total < available) y += Math.min(80, (available - total) / 3)

  let shown = 0
  rounds.forEach((r, i) => {
    if (shown < i || y + blockHeight(r, k) > maxY + 6) return
    shown++
    const theme = themeName(r.themeId)
    c.font = mono(19 * k, 600)
    c.fillStyle = AMBER
    spaced(`SIDE ${String.fromCharCode(65 + (i % 26))}${theme ? ` · ${theme.toUpperCase()}` : ''}`, L, y + 20 * k, 3)
    y += 34 * k
    c.font = note(40 * k)
    c.fillStyle = INK
    for (const line of wrap(`“${r.prompt}”`, R - L, 2)) {
      y += 40 * k
      c.fillText(line, L, y)
      y += 4 * k
    }
    y += 10 * k
    const { winners } = voteResults(r)
    r.order.slice(0, ROWS).forEach((pid, n) => {
      const pick = r.picks.find((p) => p.playerId === pid)!
      const who = playerById(s, pid)
      const rowY = y + 36 * k
      // blue rule, like an index card
      c.fillStyle = 'rgba(88,140,210,0.32)'
      c.fillRect(L, y + 50 * k, R - L, 1.5)
      c.font = mono(20 * k)
      c.fillStyle = MUTED
      c.fillText(String(n + 1).padStart(2, '0'), L, rowY)
      // who picked it: their ink colour + name (crowned if it won the round)
      const crowned = winners.includes(pid)
      const name = who?.name ?? ''
      c.font = sans(26 * k, crowned ? 700 : 500)
      const nameW = c.measureText(name).width
      const nameX = R - nameW
      c.fillStyle = crowned ? INK : MUTED
      c.fillText(name, nameX, rowY)
      if (crowned && name) drawCrown(c, nameX + c.measureText(Array.from(name)[0]).width * 0.45, rowY - 26 * k * 0.78, 26 * k * 0.95)
      c.fillStyle = inkColor(who?.color)
      c.beginPath()
      c.arc(nameX - 18 * k, rowY - 9 * k, 8 * k, 0, Math.PI * 2)
      c.fill()
      const titleX = L + 52 * k
      const room = nameX - 40 * k - titleX
      c.font = sans(29 * k, 700)
      const title = ellipsize(pick.track.title, room * 0.72)
      c.fillStyle = INK
      c.fillText(title, titleX, rowY)
      const tw = c.measureText(title).width
      c.font = sans(26 * k)
      c.fillStyle = MUTED
      c.fillText(ellipsize(` — ${pick.track.artist}`, Math.max(0, room - tw)), titleX + tw, rowY)
      y += 52 * k
    })
    if (r.order.length > ROWS) {
      c.font = mono(20 * k)
      c.fillStyle = MUTED
      c.fillText(`+ ${r.order.length - ROWS} more`, L + 52 * k, y + 26 * k)
      y += 30 * k
    }
    y += 34 * k
  })
  if (shown < rounds.length) {
    c.font = mono(20)
    c.fillStyle = MUTED
    spaced(`+ ${rounds.length - shown} MORE ${rounds.length - shown === 1 ? 'SIDE' : 'SIDES'}`, L, Math.min(y + 4, maxY + 10), 3)
  }

  // ---- Footer: a rule, the sign-off on the left, the Fan favorite stamp on the right ----
  const FY = PY + PH - 64
  c.fillStyle = INK
  c.fillRect(L, FY - 82, R - L, 2)
  let stampLeft = R
  if (favs.length) {
    const rx = reactionTotals(s)
    const names = favs.map((id) => playerById(s, id)?.name ?? '?').join(' & ')
    const top = rx[favs[0]].top
    const label = `FAN FAVORITE · ${names.toUpperCase()} · ${rx[favs[0]].total}${top ? ` ${top}` : ''}`
    c.save()
    c.font = mono(22, 700)
    const sw = spacedWidth(label, 3) + 36
    stampLeft = R - sw - 8
    c.translate(R - sw / 2 - 4, FY - 22)
    c.rotate((-4 * Math.PI) / 180)
    c.strokeStyle = NEON
    c.lineWidth = 4
    c.globalAlpha = 0.85
    c.strokeRect(-sw / 2, -27, sw, 50)
    c.fillStyle = NEON
    spaced(label, -sw / 2 + 18, 7, 3)
    c.restore()
  }
  c.fillStyle = INK
  if (guessing) {
    const top = Math.max(0, ...Object.values(pts))
    const leaders = s.players.filter((p) => top > 0 && pts[p.id] === top).map((p) => p.name)
    c.font = note(28)
    c.fillText(leaders.length ? `Best guesser: ${leaders.join(' & ')} (${top})` : 'Nobody guessed right.', L, FY - 38)
  }
  c.font = note(30)
  c.fillStyle = MUTED
  if (L + c.measureText('every song has a story').width + 20 < stampLeft) c.fillText('every song has a story', L, FY + (guessing ? 2 : -12))

  c.restore() // poster tilt

  // Tape holding the poster down, and the selfie (if any) taped on top
  drawTape(c, PX + 70, PY + 6, -10)
  drawTape(c, PX + PW - 70, PY + 4, 8)
  if (photo) drawPolaroid(c, photo, W - PX - 175, PY + 210, 320, 6)

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw image'))), 'image/png'))
}

/** A strip of amber masking tape centred at (x, y). */
function drawTape(c: CanvasRenderingContext2D, x: number, y: number, deg: number) {
  c.save()
  c.translate(x, y)
  c.rotate((deg * Math.PI) / 180)
  c.fillStyle = 'rgba(244,169,73,0.78)'
  c.shadowColor = 'rgba(0,0,0,0.25)'
  c.shadowBlur = 4
  c.beginPath()
  const w = 150
  const h = 40
  c.moveTo(-w / 2, -h / 2)
  for (let i = 0; i <= 6; i++) c.lineTo(-w / 2 + (i % 2 ? 4 : 0), -h / 2 + (h / 6) * i)
  for (let i = 6; i >= 0; i--) c.lineTo(w / 2 - (i % 2 ? 4 : 0), -h / 2 + (h / 6) * i)
  c.closePath()
  c.fill()
  c.shadowColor = 'transparent'
  c.fillStyle = 'rgba(255,255,255,0.12)'
  for (let i = -w / 2 + 6; i < w / 2; i += 12) c.fillRect(i, -h / 2, 5, h)
  c.restore()
}

/** The neon cassette logo, centred at (x, y). */
function drawCassetteMark(c: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) {
  const k = w / 76
  c.save()
  c.translate(x - w / 2, y - (52 * k) / 2)
  c.scale(k, k)
  c.strokeStyle = color
  c.lineWidth = 4
  c.lineJoin = 'round'
  c.lineCap = 'round'
  c.shadowColor = color
  c.shadowBlur = 6
  c.beginPath()
  c.roundRect(2.5, 2.5, 71, 47, 7)
  c.moveTo(31, 22)
  c.arc(24, 22, 7, 0, Math.PI * 2)
  c.moveTo(59, 22)
  c.arc(52, 22, 7, 0, Math.PI * 2)
  c.moveTo(31, 22)
  c.lineTo(45, 22)
  c.moveTo(16, 49.5)
  c.lineTo(20, 41)
  c.lineTo(56, 41)
  c.lineTo(60, 49.5)
  c.stroke()
  c.restore()
}

/** A little gold crown, tilted, with its base centred at (x, y). */
function drawCrown(c: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const w = size
  const h = size * 0.72
  c.save()
  c.translate(x, y)
  c.rotate((-18 * Math.PI) / 180)
  c.beginPath()
  c.moveTo(-w / 2, 0)
  c.lineTo(-w / 2, -h * 0.75)
  c.lineTo(-w / 4, -h * 0.35)
  c.lineTo(0, -h)
  c.lineTo(w / 4, -h * 0.35)
  c.lineTo(w / 2, -h * 0.75)
  c.lineTo(w / 2, 0)
  c.closePath()
  c.fillStyle = '#f5c84c'
  c.strokeStyle = '#a4730d'
  c.lineWidth = Math.max(1.5, size * 0.07)
  c.lineJoin = 'round'
  c.fill()
  c.stroke()
  c.restore()
}

/** A white-bordered photo, centred at (cx, cy), tilted by `deg`. */
function drawPolaroid(c: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, width: number, deg: number) {
  const border = width * 0.06
  const photoW = width - border * 2
  const photoH = photoW * 0.75
  const height = photoH + border * 2 + border * 1.6
  c.save()
  c.translate(cx, cy)
  c.rotate((deg * Math.PI) / 180)
  c.shadowColor = 'rgba(30,20,60,0.28)'
  c.shadowBlur = 30
  c.shadowOffsetY = 12
  c.fillStyle = '#ffffff'
  c.fillRect(-width / 2, -height / 2, width, height)
  c.shadowColor = 'transparent'
  // cover-crop the photo into the frame
  const scale = Math.max(photoW / img.width, photoH / img.height)
  const sw = photoW / scale
  const sh = photoH / scale
  c.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, -width / 2 + border, -height / 2 + border, photoW, photoH)
  c.restore()
}
