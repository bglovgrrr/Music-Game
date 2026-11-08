import { useId, useState } from 'react'
import { Tiltable } from '@/components/tilt-album'
import type { Track } from '@/game/types'
import { cn } from '@/lib/utils'

/**
 * A realistic cassette (drawn in SVG): smoked shell, screws, a paper label with a
 * handwritten title, the window with both reels and the tape pack, and the head opening.
 */
type LabelArt = { url?: string; hue: number }

/** Album art printed on the label: an <img> placed over the label's art square (x28 y24, 80×80 of 400×252). */
function LabelArtImage({ url }: { url: string }) {
  const [ok, setOk] = useState(true)
  if (!ok) return null
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      onError={() => setOk(false)}
      className="pointer-events-none absolute rounded-[2px] object-cover shadow-[inset_0_0_0_1px_rgb(0_0_0/0.25)] [filter:saturate(0.92)_contrast(1.02)]"
      style={{ left: '7%', top: '9.52%', width: '20%', height: '31.75%' }}
    />
  )
}

const fit = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

function CassetteFace({
  side,
  title,
  subtitle,
  spinning,
  wound = 0.65,
  art,
}: {
  side: 'A' | 'B'
  title: string
  subtitle: string
  spinning?: boolean
  /** How much tape is still on the left reel (1 = start of the song, 0 = end). */
  wound?: number
  /** Album art printed on the label. */
  art?: LabelArt
}) {
  const id = useId().replace(/:/g, '')
  // Tape pack sizes: left full at the start, right full at the end.
  const left = 16 + 22 * wound
  const right = 16 + 22 * (1 - wound)
  const hub = (cx: number) => (
    <g className={cn(spinning && 'cassette-spin')} style={{ transformOrigin: `${cx}px 118px` }}>
      <circle cx={cx} cy={118} r={13} fill="#f1ebe1" />
      <circle cx={cx} cy={118} r={13} fill="none" stroke="#000" strokeOpacity={0.25} />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <rect key={a} x={cx - 1.6} y={118 - 8.5} width={3.2} height={4.5} rx={0.8} fill="#2a2321" transform={`rotate(${a} ${cx} 118)`} />
      ))}
      <circle cx={cx} cy={118} r={4.2} fill="#2a2321" />
    </g>
  )
  const screw = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <circle cx={x} cy={y} r={5.2} fill={`url(#${id}-screw)`} stroke="#000" strokeOpacity={0.5} strokeWidth={0.8} />
      <path d={`M${x - 3} ${y}h6M${x} ${y - 3}v6`} stroke="#1b1513" strokeWidth={1.2} strokeLinecap="round" />
    </g>
  )
  return (
    <div className="relative size-full">
      <svg viewBox="0 0 400 252" className="block size-full" aria-hidden>
        <defs>
          <linearGradient id={`${id}-shell`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a3230" />
            <stop offset="0.5" stopColor="#221c1a" />
            <stop offset="1" stopColor="#171211" />
          </linearGradient>
          <radialGradient id={`${id}-screw`} cx="0.35" cy="0.35" r="0.8">
            <stop offset="0" stopColor="#d9d4cc" />
            <stop offset="1" stopColor="#6f6862" />
          </radialGradient>
          <linearGradient id={`${id}-window`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4a3a33" stopOpacity={0.85} />
            <stop offset="1" stopColor="#1c1513" stopOpacity={0.95} />
          </linearGradient>
          <pattern id={`${id}-grip`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="none" />
            <path d="M0 6L6 0" stroke="#fff" strokeOpacity={0.05} />
          </pattern>
          <clipPath id={`${id}-clip`}>
            <rect x={112} y={96} width={176} height={44} rx={22} />
          </clipPath>
        </defs>

        {/* shell */}
        <rect x={1} y={1} width={398} height={250} rx={16} fill={`url(#${id}-shell)`} />
        <rect x={1} y={1} width={398} height={250} rx={16} fill={`url(#${id}-grip)`} />
        <rect x={1.5} y={1.5} width={397} height={249} rx={15.5} fill="none" stroke="#fff" strokeOpacity={0.12} />

        {/* label */}
        <rect x={22} y={18} width={356} height={160} rx={7} fill="#efe4d1" />
        <rect x={22} y={18} width={356} height={160} rx={7} fill="none" stroke="#000" strokeOpacity={0.15} />
        <rect x={22} y={150} width={356} height={8} fill="#f4a949" />
        <rect x={22} y={160} width={356} height={4} fill="#ff4fa3" />
        {art ? (
          <>
            {/* album art printed on the label */}
            {/* the artwork image itself is an <img> laid over this spot (see below) */}
            <rect x={28} y={24} width={80} height={80} rx={3} fill={`hsl(${art.hue} 42% 45%)`} />
            <path d="M118 62H352M118 86H352" stroke="#5a8cd2" strokeOpacity={0.35} strokeWidth={1} />
            <text x={362} y={48} textAnchor="end" fontFamily="Geist Mono, monospace" fontSize={20} fontWeight={700} fill="#2a1e18">
              {side}
            </text>
            <text x={118} y={56} fontFamily="Instrument Serif, serif" fontStyle="italic" fontSize={26} fill="#2a1e18">
              {fit(title, 18)}
            </text>
            <text x={118} y={80} fontFamily="Instrument Serif, serif" fontStyle="italic" fontSize={17} fill="#6b5546">
              {fit(subtitle, 27)}
            </text>
          </>
        ) : (
          <>
            {/* writing lines */}
            <path d="M78 64H362M38 86H362" stroke="#5a8cd2" strokeOpacity={0.35} strokeWidth={1} />
            <text x={36} y={60} fontFamily="Geist Mono, monospace" fontSize={22} fontWeight={700} fill="#2a1e18">
              {side}
            </text>
            <text x={84} y={58} fontFamily="Instrument Serif, serif" fontStyle="italic" fontSize={30} fill="#2a1e18">
              {title}
            </text>
            <text x={84} y={80} fontFamily="Instrument Serif, serif" fontStyle="italic" fontSize={17} fill="#6b5546">
              {subtitle}
            </text>
          </>
        )}
        <text x={364} y={142} textAnchor="end" fontFamily="Geist Mono, monospace" fontSize={11} letterSpacing={2} fill="#6b5546">
          C90
        </text>

        {/* window: tape packs + reels */}
        <rect x={110} y={94} width={180} height={48} rx={24} fill="#120d0c" />
        <g clipPath={`url(#${id}-clip)`}>
          <rect x={112} y={96} width={176} height={44} fill={`url(#${id}-window)`} />
          <circle cx={160} cy={118} r={left} fill="#3b2418" />
          <circle cx={240} cy={118} r={right} fill="#3b2418" />
          <path d={`M${160 - left} 140H${240 + right}`} stroke="#2a180f" strokeWidth={2} />
          {hub(160)}
          {hub(240)}
          <rect x={112} y={96} width={176} height={14} fill="#fff" fillOpacity={0.06} />
        </g>
        <rect x={110} y={94} width={180} height={48} rx={24} fill="none" stroke="#000" strokeOpacity={0.6} strokeWidth={1.5} />

        {/* head opening */}
        <path d="M96 251L114 198H286L304 251Z" fill="#2b2421" stroke="#000" strokeOpacity={0.4} />
        <path d="M114 198H286" stroke="#fff" strokeOpacity={0.1} />
        <circle cx={150} cy={226} r={6} fill="#0e0a09" />
        <circle cx={250} cy={226} r={6} fill="#0e0a09" />
        <rect x={186} y={216} width={28} height={14} rx={2} fill="#0e0a09" />
        <rect x={126} y={238} width={10} height={10} fill="#0e0a09" />
        <rect x={264} y={238} width={10} height={10} fill="#0e0a09" />

        {[screw(14, 14), screw(386, 14), screw(14, 238), screw(386, 238), screw(200, 205)]}
      </svg>
      {art?.url && <LabelArtImage url={art.url} />}
    </div>
  )
}

/** The cassette you can pick up and turn: side A on the front, side B on the back. */
export function Cassette({ className, spinning = true }: { className?: string; spinning?: boolean }) {
  return (
    <Tiltable
      label="A mixtape"
      floating
      className={className}
      shapeClassName="aspect-[400/252]"
      radius="rounded-[4%/6.3%]"
      front={<CassetteFace side="A" title="Mixtape Memories" subtitle="every song has a story" spinning={spinning} />}
      back={<CassetteFace side="B" title="Rewind, replay" subtitle="play loud, tell the story" spinning={spinning} wound={0.35} />}
    />
  )
}

/**
 * The song as a cassette: album art printed on the label, reels turning while it plays,
 * and the tape moving from the left reel to the right as the song goes. Pick it up and
 * turn it like the home-screen tape; the back (side B) can carry a line like "Picked by…".
 */
export function SongCassette({
  track,
  playing,
  progress,
  back,
  className,
}: {
  track: Track
  playing: boolean
  /** 0..1 through the song. */
  progress: number
  back?: string
  className?: string
}) {
  const hue = track.hue ?? [...track.title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
  const art = { url: track.artwork, hue }
  const wound = 1 - Math.max(0, Math.min(1, progress))
  return (
    <Tiltable
      label={`${track.title} by ${track.artist}`}
      resetKey={track.id}
      floating={playing}
      className={className}
      shapeClassName="aspect-[400/252]"
      radius="rounded-[4%/6.3%]"
      front={<CassetteFace side="A" title={track.title} subtitle={track.artist} spinning={playing} wound={wound} art={art} />}
      back={
        <CassetteFace
          side="B"
          title={back ?? 'Mixtape Memories'}
          subtitle={back ? track.title : 'every song has a story'}
          spinning={playing}
          wound={wound}
          art={art}
        />
      }
    />
  )
}
