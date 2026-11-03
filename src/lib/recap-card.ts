import { playerById, scores, voteResults } from '@/game/engine'
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
  const PAD = 84
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')!

  try {
    await Promise.all([
      document.fonts.load('italic 500 64px Fraunces'),
      document.fonts.load('500 64px Fraunces'),
      document.fonts.load('600 32px Figtree'),
      document.fonts.load('400 32px Figtree'),
    ])
  } catch {
    /* fall back to system fonts */
  }

  const INK = '#23202f'
  const MUTED = 'rgba(35,32,47,0.62)'
  const serif = (size: number, italic = false, weight = 500) => `${italic ? 'italic ' : ''}${weight} ${size}px Fraunces, Georgia, serif`
  const sans = (size: number, weight = 400) => `${weight} ${size}px Figtree, system-ui, sans-serif`

  // Background: soft pastel wash
  const bg = c.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#e4e0ff')
  bg.addColorStop(0.55, '#ffe0ec')
  bg.addColorStop(1, '#ffe8d6')
  c.fillStyle = bg
  c.fillRect(0, 0, W, H)
  const glow = (x: number, y: number, r: number, color: string) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = g
    c.fillRect(0, 0, W, H)
  }
  glow(W * 0.9, H * 0.08, 520, 'rgba(255,255,255,0.7)')
  glow(W * 0.05, H * 0.95, 600, 'rgba(197,236,220,0.6)')

  // Header
  c.fillStyle = INK
  c.font = serif(40, true, 600)
  c.textBaseline = 'alphabetic'
  c.fillText('Side B', PAD, PAD + 30)
  c.font = sans(26)
  c.fillStyle = MUTED
  const date = new Date(s.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  const meta = `${date} · ${s.players.length} friends`
  if (photo) c.fillText(meta, PAD, PAD + 230)
  else c.fillText(meta, W - PAD - c.measureText(meta).width, PAD + 28)

  c.fillStyle = INK
  c.font = serif(92, true, 500)
  c.fillText('Our mixtape', PAD, PAD + 170)

  if (photo) drawPolaroid(c, photo, W - PAD - 150, PAD + 175, 330, 6)

  // Rounds
  const rounds = s.rounds.filter((r) => r.order.length)
  const pts = scores(s)
  const guessing = s.rounds.some((r) => r.guessMode)
  const footerH = guessing ? 120 : 70
  const maxY = H - PAD - footerH
  let y = PAD + (photo ? 420 : 270)
  let shownRounds = 0

  const ellipsize = (text: string, max: number) => {
    if (c.measureText(text).width <= max) return text
    let t = text
    while (t.length > 1 && c.measureText(`${t}…`).width > max) t = t.slice(0, -1)
    return `${t.trimEnd()}…`
  }
  const wrap = (text: string, max: number, lines: number) => {
    const words = text.split(' ')
    const out: string[] = []
    let line = ''
    for (const w of words) {
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

  // Scale text up when there's little to show, so the card never looks empty.
  const blockHeight = (r: (typeof rounds)[number], k: number) => {
    c.font = serif(40 * k, true, 500)
    const lines = wrap(r.prompt, W - PAD * 2, 2).length
    return (lines * 50 + Math.min(r.order.length, 5) * 54 + 44 + (r.order.length > 5 ? 20 : 0)) * k
  }
  const available = maxY - y
  const natural = rounds.reduce((h, r) => h + blockHeight(r, 1), 0)
  let k = Math.min(1.6, Math.max(1, available / Math.max(natural, 1)))
  while (k > 1 && rounds.reduce((h, r) => h + blockHeight(r, k), 0) > available) k -= 0.05
  // Centre whatever is left over between the title and the footer.
  const total = rounds.reduce((h, r) => h + blockHeight(r, k), 0)
  if (total < available) y += Math.min(160, (available - total) / 2)

  for (const r of rounds) {
    c.font = serif(40 * k, true, 500)
    const promptLines = wrap(r.prompt, W - PAD * 2, 2)
    const songRows = Math.min(r.order.length, 5)
    const need = blockHeight(r, k)
    if (y + need > maxY) break
    shownRounds++

    c.fillStyle = INK
    for (const line of promptLines) {
      c.fillText(line, PAD, y)
      y += 50 * k
    }
    y += 8 * k
    const { winners } = voteResults(r)
    for (const pid of r.order.slice(0, songRows)) {
      const pick = r.picks.find((p) => p.playerId === pid)!
      const who = playerById(s, pid)
      // colour dot for the player
      c.fillStyle = who?.color ?? '#cfcaff'
      c.beginPath()
      const dot = 14 * k
      c.arc(PAD + dot, y - 11 * k, dot, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = INK
      c.font = sans(16 * k, 700)
      const initial = (who?.name ?? '?').slice(0, 1).toUpperCase()
      c.fillText(initial, PAD + dot - c.measureText(initial).width / 2, y - 5 * k)

      const crowned = winners.includes(pid)
      const nameSize = 26 * k
      c.font = crowned ? sans(nameSize, 700) : sans(nameSize)
      const name = who?.name ?? ''
      const nameW = c.measureText(name).width
      const nameX = W - PAD - nameW
      c.fillStyle = crowned ? INK : MUTED
      c.fillText(name, nameX, y)
      if (crowned && name) {
        const firstW = c.measureText(Array.from(name)[0]).width
        drawCrown(c, nameX + firstW * 0.45, y - nameSize * 0.78, nameSize * 0.95)
      }
      c.font = sans(30 * k, 600)
      c.fillStyle = INK
      const title = ellipsize(`${pick.track.title} — ${pick.track.artist}`, W - PAD * 2 - dot * 2 - 16 - nameW - 48)
      c.fillText(title, PAD + dot * 2 + 16, y)
      y += 54 * k
    }
    if (r.order.length > songRows) {
      c.font = sans(24)
      c.fillStyle = MUTED
      c.fillText(`+ ${r.order.length - songRows} more`, PAD + 44, y - 12)
      y += 20 * k
    }
    y += 36 * k
  }
  if (shownRounds < rounds.length) {
    c.font = sans(26)
    c.fillStyle = MUTED
    c.fillText(`+ ${rounds.length - shownRounds} more ${rounds.length - shownRounds === 1 ? 'question' : 'questions'}`, PAD, Math.min(y, maxY))
  }

  // Footer
  c.fillStyle = 'rgba(35,32,47,0.12)'
  c.fillRect(PAD, H - PAD - footerH + 24, W - PAD * 2, 2)
  c.fillStyle = INK
  if (guessing) {
    const top = Math.max(0, ...Object.values(pts))
    const leaders = s.players.filter((p) => top > 0 && pts[p.id] === top).map((p) => p.name)
    c.font = sans(30, 600)
    c.fillText(leaders.length ? `Best guesser: ${leaders.join(' & ')} (${top})` : 'Nobody guessed right. Mysterious bunch.', PAD, H - PAD - 34)
  }
  c.font = sans(24)
  c.fillStyle = MUTED
  c.fillText('Every song has a story.', PAD, H - PAD)

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw image'))), 'image/png'))
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
