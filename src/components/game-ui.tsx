import { Check, Crown, Disc3 } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import type { Player, Track } from '@/game/types'
import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="brand-gradient grid size-8 place-items-center rounded-full">
        <Disc3 className="size-[18px]" strokeWidth={2.25} />
      </span>
      <span className="font-display text-xl font-semibold tracking-tight font-soft">
        Side <span className="italic">B</span>
      </span>
    </div>
  )
}

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
  const sizes = { sm: 'size-7 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg', xl: 'size-20 text-2xl' }
  return (
    <span className={cn('relative inline-grid shrink-0', className)}>
      <span
        className={cn(
          'grid place-items-center rounded-full font-sans font-bold text-ink',
          sizes[size],
          ring && 'ring-2 ring-offset-2 ring-offset-background',
        )}
        style={{ backgroundColor: player.color, ...(ring ? { ['--tw-ring-color' as string]: player.color } : {}) }}
        title={player.name}
      >
        {player.name.slice(0, 1).toUpperCase()}
      </span>
      {done && (
        <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full border-2 border-card bg-success text-card">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </span>
  )
}

export function AvatarStack({ players, max = 5 }: { players: Player[]; max?: number }) {
  return (
    <div className="mr-1 flex -space-x-2">
      {players.slice(0, max).map((p) => (
        <PlayerAvatar key={p.id} player={p} size="sm" className="rounded-full ring-2 ring-background" />
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
        <span className="font-display text-xl text-muted-foreground italic">?</span>
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
      className={cn('relative aspect-square overflow-hidden text-ink [container-type:inline-size]', rounded, className)}
      style={{
        background: `radial-gradient(circle at 75% 20%, hsl(${(hue + 40) % 360} 95% 90%), transparent 55%), linear-gradient(150deg, hsl(${hue} 85% 84%), hsl(${(hue + 50) % 360} 75% 76%))`,
      }}
    >
      <span className="absolute top-[9cqw] right-[9cqw] @max-[5rem]:hidden size-[18cqw] rounded-full border-[1.5px] border-ink/25" />
      <span className="absolute inset-x-0 bottom-0 line-clamp-3 p-[9cqw] @max-[5rem]:hidden font-display text-[clamp(0.4rem,12cqw,2.2rem)] leading-[1.05] font-semibold italic font-soft">
        {track.title}
      </span>
    </div>
  )
}

export function PromptCard({ prompt, asker, compact }: { prompt: string; asker?: Player; compact?: boolean }) {
  return (
    <div className={cn('relative overflow-hidden rounded-[1.4rem] brand-gradient', compact ? 'px-4 py-3.5' : 'p-5 sm:p-7')}>
      <div className="pointer-events-none absolute -top-16 -right-12 size-48 rounded-full bg-white/35 blur-3xl" />
      {asker && (
        <div className={cn('flex items-center gap-2 text-sm font-medium text-ink/70', compact ? 'mb-1' : 'mb-3')}>
          <PlayerAvatar player={asker} size="sm" className="rounded-full ring-2 ring-white/60" />
          {asker.name} asks
        </div>
      )}
      <p className={cn('relative font-display leading-snug font-medium text-balance italic font-soft', compact ? 'text-lg' : 'text-[1.7rem] sm:text-4xl')}>
        {prompt}
      </p>
    </div>
  )
}

export function Equalizer({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex h-3.5 items-end gap-[2px]', className)} aria-hidden>
      {[0, 0.2, 0.4, 0.1].map((d, i) => (
        <span
          key={i}
          className={cn('w-[3px] rounded-full bg-current', playing ? 'eq-bar' : 'h-1')}
          style={playing ? { animationDelay: `${d}s`, height: '100%' } : undefined}
        />
      ))}
    </span>
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
