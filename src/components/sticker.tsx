import { inkIndex } from '@/game/colors'
import { cn } from '@/lib/utils'

/**
 * Die-cut vinyl stickers, one per player (fun 80s things). Each is drawn twice: first as a
 * fat white silhouette (the die-cut edge), then the artwork on top. Colour = the player's ink.
 */
const INK = '#1e140f'
const CREAM = '#fff8ee'

type Art = (c: string) => React.ReactNode

const ART: { name: string; art: Art }[] = [
  {
    name: 'cassette',
    art: (c) => (
      <>
        <rect x="7" y="15" width="50" height="34" rx="5" fill={c} stroke={INK} strokeWidth="3" />
        <rect x="13" y="20" width="38" height="13" rx="2" fill={CREAM} stroke={INK} strokeWidth="2" />
        <circle cx="24" cy="38" r="4.5" fill={INK} />
        <circle cx="40" cy="38" r="4.5" fill={INK} />
        <path d="M20 49l3-6h18l3 6" fill="none" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      </>
    ),
  },
  {
    name: 'boombox',
    art: (c) => (
      <>
        <path d="M17 19v-7h30v7" fill="none" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
        <rect x="5" y="18" width="54" height="32" rx="5" fill={c} stroke={INK} strokeWidth="3" />
        <circle cx="18" cy="35" r="9" fill={INK} />
        <circle cx="18" cy="35" r="4" fill={c} />
        <circle cx="46" cy="35" r="9" fill={INK} />
        <circle cx="46" cy="35" r="4" fill={c} />
        <rect x="28" y="25" width="8" height="12" rx="1.5" fill={CREAM} stroke={INK} strokeWidth="2" />
      </>
    ),
  },
  {
    name: 'headphones',
    art: (c) => (
      <>
        <path d="M14 40v-8a18 18 0 0 1 36 0v8" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <rect x="7" y="34" width="13" height="20" rx="5" fill={c} stroke={INK} strokeWidth="3" />
        <rect x="44" y="34" width="13" height="20" rx="5" fill={c} stroke={INK} strokeWidth="3" />
      </>
    ),
  },
  {
    name: 'shutter shades',
    art: (c) => (
      <>
        <path
          d="M4 22h56l-3 18c-1 5-5 8-10 8h-5c-5 0-8-4-9-8l-1-5h-0l-1 5c-1 4-4 8-9 8h-5c-5 0-9-3-10-8z"
          fill={c}
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M9 28h18M9 34h18M9 40h17M37 28h18M37 34h18M38 40h17" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      </>
    ),
  },
  {
    name: 'lightning bolt',
    art: (c) => <path d="M37 4L13 36h16l-6 24 28-34H34l8-22z" fill={c} stroke={INK} strokeWidth="3" strokeLinejoin="round" />,
  },
  {
    name: 'joystick',
    art: (c) => (
      <>
        <rect x="30" y="18" width="4.5" height="24" rx="2" fill={INK} />
        <circle cx="32" cy="15" r="8.5" fill="#ff4fa3" stroke={INK} strokeWidth="3" />
        <rect x="9" y="38" width="46" height="16" rx="4" fill={c} stroke={INK} strokeWidth="3" />
        <circle cx="47" cy="46" r="3.5" fill={CREAM} stroke={INK} strokeWidth="2" />
      </>
    ),
  },
  {
    name: 'star',
    art: (c) => (
      <>
        <path
          d="M32 5l7.6 16.3 17.9 2.1-13.2 12.3 3.5 17.7L32 44.6l-15.8 8.8 3.5-17.7L6.5 23.4l17.9-2.1z"
          fill={c}
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M51 6l1.5 4 4 1.5-4 1.5L51 17l-1.5-4-4-1.5 4-1.5z" fill={CREAM} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      </>
    ),
  },
  {
    name: 'puzzle cube',
    art: (c) => (
      <>
        <path d="M32 6l24 12-24 12L8 18z" fill={CREAM} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M8 18l24 12v28L8 46z" fill={c} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M56 18L32 30v28l24-12z" fill="#ff4fa3" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M16 22L40 10M24 26L48 14M16 14L40 26M24 10L48 22" stroke={INK} strokeWidth="1.8" />
        <path d="M8 27.3l24 12M8 36.7l24 12M16 22v28M24 26v28M56 27.3l-24 12M56 36.7l-24 12M48 22v28M40 26v28" stroke={INK} strokeWidth="1.8" />
      </>
    ),
  },
]

/** Which sticker a player gets: by their colour slot, else a hash of their id. */
function stickerFor(player: { id: string; color?: string }) {
  const i = inkIndex(player.color)
  if (i >= 0) return ART[i % ART.length]
  let h = 0
  for (const ch of player.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return ART[h % ART.length]
}

/** A small, stable tilt per player so stickers look hand-placed. */
function stickerTilt(id: string) {
  let h = 7
  for (const ch of id) h = (h * 33 + ch.charCodeAt(0)) >>> 0
  return (h % 17) - 8
}

export function Sticker({
  player,
  color,
  className,
  tilt = true,
}: {
  player: { id: string; color?: string }
  color: string
  className?: string
  tilt?: boolean
}) {
  const s = stickerFor(player)
  const art = s.art(color)
  return (
    <svg
      viewBox="-4 -4 72 72"
      className={cn('block drop-shadow-[0_1px_1px_rgb(0_0_0/0.35)] drop-shadow-[0_4px_5px_rgb(0_0_0/0.35)]', className)}
      style={tilt ? { transform: `rotate(${stickerTilt(player.id)}deg)` } : undefined}
      aria-hidden
    >
      {/* die-cut edge */}
      <g className="sticker-cut">{art}</g>
      {art}
    </svg>
  )
}
