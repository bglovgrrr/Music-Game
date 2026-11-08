import { Check, Crown } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Washi } from '@/components/physical'
import { Sticker } from '@/components/sticker'
import { inkColor } from '@/game/colors'
import type { Player, Track } from '@/game/types'
import { cn } from '@/lib/utils'

/** Neon cassette mark + wordmark. */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <svg
        viewBox="0 0 76 52"
        className="h-[22px] w-8 shrink-0 text-neon drop-shadow-[0_0_6px_var(--neon)]"
        fill="none"
        stroke="currentColor"
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="2.5" y="2.5" width="71" height="47" rx="7" />
        <circle cx="24" cy="22" r="7" />
        <circle cx="52" cy="22" r="7" />
        <path d="M31 22h14M16 49.5l4-8.5h36l4 8.5" />
      </svg>
      <span className="font-display text-xl leading-none font-extrabold tracking-[-0.01em] [font-stretch:78%]">Mixtape Memories</span>
    </div>
  )
}

/** A player's sticker (die-cut 80s vinyl sticker in their ink colour). */
export function PlayerAvatar({
  player,
  size = 'md',
  done,
  ring,
  className,
}: {
  player: Player
  size?: 'sm' | 'md' | 'lg' | 'xl'
  done?: boolean
  ring?: boolean
  className?: string
}) {
  const sizes = { sm: 'size-7', md: 'size-10', lg: 'size-14', xl: 'size-20' }
  return (
    <span className={cn('relative inline-grid shrink-0', sizes[size], className)} title={player.name}>
      <Sticker player={player} color={inkColor(player.color)} className={cn('size-full', ring && 'drop-shadow-[0_0_6px_var(--neon)]')} />
      <span className="sr-only">{player.name}</span>
      {done && (
        <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full border-2 border-[#fffdf8] bg-success text-[#fffdf8]">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </span>
  )
}

export function AvatarStack({ players, max = 5 }: { players: Player[]; max?: number }) {
  return (
    <div className="mr-1 flex -space-x-1.5">
      {players.slice(0, max).map((p) => (
        <PlayerAvatar key={p.id} player={p} size="sm" />
      ))}
      {players.length > max && (
        <span className="grid size-7 place-items-center rounded-full bg-muted text-xs ring-2 ring-background">
          +{players.length - max}
        </span>
      )}
    </div>
  )
}

/** Album cover, or a generated gradient cover when there's no artwork. `hidden` = mystery song. */
export function AlbumArt({
  track,
  hidden,
  className,
  rounded = 'rounded-xl',
}: {
  track?: Track
  hidden?: boolean
  className?: string
  rounded?: string
}) {
  const [broken, setBroken] = useState(false)
  if (hidden || !track) {
    return (
      <div className={cn('relative grid aspect-square place-items-center overflow-hidden border border-dashed bg-muted', rounded, className)}>
        <span className="font-note text-2xl text-muted-foreground italic">?</span>
      </div>
    )
  }
  if (track.artwork && !broken) {
    return (
      <img
        src={track.artwork}
        alt=""
        onError={() => setBroken(true)}
        className={cn('aspect-square object-cover', rounded, className)}
        draggable={false}
      />
    )
  }
  const hue = track.hue ?? [...track.title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
  return (
    <div
      className={cn('relative aspect-square overflow-hidden text-[#f6efe2] [container-type:inline-size]', rounded, className)}
      style={{
        background: `radial-gradient(circle at 75% 20%, hsl(${(hue + 40) % 360} 55% 62% / 0.9), transparent 55%), linear-gradient(150deg, hsl(${hue} 42% 52%), hsl(${(hue + 50) % 360} 38% 34%))`,
      }}
    >
      <span className="absolute top-[9cqw] right-[9cqw] @max-[5rem]:hidden size-[18cqw] rounded-full border-[1.5px] border-[#f6efe2]/40" />
      <span className="absolute inset-x-0 bottom-0 line-clamp-3 p-[9cqw] @max-[5rem]:hidden font-display text-[clamp(0.4rem,12cqw,2.2rem)] leading-[1.05] font-bold font-soft">
        {track.title}
      </span>
    </div>
  )
}

/** The question for the round: a note on lined paper, taped to the table. */
export function PromptCard({ prompt, asker, compact, topic }: { prompt: string; asker?: Player; compact?: boolean; topic?: string }) {
  return (
    <div className={cn('drop-on-table relative', compact ? 'mt-2' : 'mt-3')} style={{ transform: `rotate(${compact ? -0.6 : -1}deg)` }}>
      <Washi className="-top-3 left-1/2 -ml-12 z-10" tilt={-3} />
      <div className={cn('paper paper-texture torn-bottom rounded-[3px] bg-[var(--paper)]', compact ? 'px-4 pt-3 pb-4' : 'px-5 pt-6 pb-7 sm:px-7')}>
        {asker && (
          <div className={cn('flex items-center gap-2 font-mono text-[0.7rem] tracking-[0.14em] text-muted-foreground uppercase', compact ? 'mb-1' : 'mb-2')}>
            <PlayerAvatar player={asker} size="sm" />
            {asker.name} asks
            {topic && <span className="ml-auto truncate text-[#a0560b]">{topic}</span>}
          </div>
        )}
        <p className={cn('font-note leading-[1.15] text-balance italic', compact ? 'line-clamp-2 text-[1.2rem] [@media(max-height:700px)]:line-clamp-1' : 'text-[2rem] sm:text-[2.6rem]')}>{prompt}</p>
      </div>
    </div>
  )
}

export function TrackRow({
  track,
  onClick,
  right,
  active,
}: {
  track: Track
  onClick?: () => void
  right?: React.ReactNode
  active?: boolean
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors',
        onClick && 'cursor-pointer hover:bg-muted active:bg-muted',
        active && 'bg-secondary',
      )}
    >
      <AlbumArt track={track} className="size-12 shrink-0" rounded="rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{track.title}</div>
        <div className="truncate text-sm text-muted-foreground">{track.artist}</div>
      </div>
      {right}
    </Comp>
  )
}

/**
 * A player's name with a little gold crown perched on the first letter, tilted.
 * Used for the song-of-the-round winner. Give the parent a bit of room above
 * (it pokes out by ~0.6em) and don't put it inside `overflow: hidden`.
 */
export function CrownedName({ name, crowned, className }: { name: string; crowned?: boolean; className?: string }) {
  if (!crowned || !name) return <span className={className}>{name}</span>
  const [first, ...rest] = Array.from(name)
  return (
    <span className={cn('inline-block whitespace-nowrap', className)} title="Song of the round">
      <span className="relative inline-block">
        <motion.span
          aria-hidden
          initial={{ scale: 0, rotate: -40, y: 4 }}
          animate={{ scale: 1, rotate: -18, y: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 14 }}
          className="pointer-events-none absolute bottom-[78%] left-[30%] block origin-bottom -translate-x-1/2"
          style={{ width: '0.95em', height: '0.95em' }}
        >
          <Crown className="size-full drop-shadow-[0_1px_1px_rgb(0_0_0/0.25)]" fill="#f5c84c" stroke="#a4730d" strokeWidth={1.75} />
        </motion.span>
        {first}
      </span>
      {rest.join('')}
      <span className="sr-only">, song of the round</span>
    </span>
  )
}
