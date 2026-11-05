import { Pause, Play, Rewind, FastForward } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { SongCassette } from '@/components/cassette'
import type { Track } from '@/game/types'
import { cn, formatTime } from '@/lib/utils'

const SLIDE = {
  enter: (d: number) => ({ x: `${d * 115}%` }),
  center: { x: '0%' },
  exit: (d: number) => ({ x: `${d * -115}%` }),
}

/**
 * An old black 80s portable cassette player: textured plastic, silver print, a smoked
 * cassette door with the tape inside, a mechanical counter, LED level meters, a tape
 * position slider and chunky piano keys that latch down (PLAY stays in while it plays).
 */
export function CassetteDeck({
  track,
  playing,
  positionMs,
  durationMs,
  preview,
  back,
  isLast,
  onPlay,
  onPause,
  onPrev,
  onNext,
  onSeek,
  direction = 1,
}: {
  track: Track
  playing: boolean
  positionMs: number
  durationMs: number
  preview?: boolean
  back?: string
  isLast?: boolean
  onPlay: () => void
  onPause: () => void
  onPrev: () => void
  onNext: () => void
  onSeek: (ms: number) => void
  /** 1 = next song (tape slides in from the right), -1 = previous (from the left). */
  direction?: 1 | -1
}) {
  const pct = durationMs ? Math.min(100, (positionMs / durationMs) * 100) : 0
  const paused = !playing && positionMs > 0

  return (
    <div className="deck-body relative w-full max-w-[26rem] rounded-[18px] p-3 pb-4 text-[#bdb6ac] select-none">
      {/* top strip */}
      <div className="flex items-center gap-2 px-1 pb-2 font-mono text-[0.55rem] tracking-[0.18em] uppercase">
        <span className={cn('size-2 rounded-full transition-all', playing ? 'bg-[#ff3b3b] shadow-[0_0_8px_#ff3b3b]' : 'bg-[#4a1515]')} />
        <span>Power</span>
        <span className="ml-auto font-sans text-[0.6rem] font-bold tracking-[0.22em] text-[#d8d2c8]">Stereo cassette player</span>
        <span className="ml-auto">MM-90</span>
      </div>

      {/* cassette door */}
      <div className="deck-door relative grid overflow-hidden rounded-[10px] p-[6%] pb-[5%]">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={track.id}
            custom={direction}
            variants={SLIDE}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 170, damping: 26 }}
            className="[grid-area:1/1]"
          >
            <SongCassette track={track} playing={playing} progress={durationMs ? positionMs / durationMs : 0} back={back} />
          </motion.div>
        </AnimatePresence>
        <div className="deck-glass pointer-events-none absolute inset-0 rounded-[10px]" />
        <span className="absolute top-1.5 left-2.5 font-mono text-[0.5rem] tracking-[0.2em] text-[#8d867c] uppercase">◀ Eject</span>
      </div>

      {/* counter + meters */}
      <div className="flex items-center gap-3 px-1 pt-3">
        <div className="grid gap-1">
          <div className="flex gap-[3px]" aria-label={`${formatTime(positionMs)} of ${formatTime(durationMs)}`}>
            {formatTime(positionMs)
              .padStart(5, '0')
              .split('')
              .map((ch, i) =>
                ch === ':' ? (
                  <span key={i} className="self-center font-mono text-sm text-[#8d867c]">
                    :
                  </span>
                ) : (
                  <span key={i} className="deck-digit grid h-7 w-[1.15rem] place-items-center rounded-[3px] font-mono text-[0.95rem] text-[#f1ece4]">
                    {ch}
                  </span>
                ),
              )}
          </div>
          <span className="font-mono text-[0.5rem] tracking-[0.18em] uppercase">
            Counter · {preview ? 'preview ' : ''}
            {formatTime(durationMs)}
          </span>
        </div>
        <LevelMeters playing={playing} />
      </div>

      {/* tape position */}
      <div
        className="deck-groove group relative mx-1 mt-3 h-2 cursor-pointer rounded-full"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          onSeek(((e.clientX - r.left) / r.width) * durationMs)
        }}
        role="slider"
        aria-label="Tape position"
        aria-valuemin={0}
        aria-valuemax={Math.round(durationMs / 1000)}
        aria-valuenow={Math.round(positionMs / 1000)}
        tabIndex={0}
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-[#f4a949]/70" style={{ width: `${pct}%` }} />
        <div className="deck-knob absolute top-1/2 h-4 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px]" style={{ left: `${pct}%` }} />
      </div>

      {/* piano keys */}
      <div className="mt-4 grid grid-cols-4 gap-1.5 px-0.5">
        <PianoKey label="Rew" onClick={onPrev} aria="Previous song">
          <Rewind className="size-4" fill="currentColor" />
        </PianoKey>
        <PianoKey label="Play" down={playing} accent onClick={onPlay} aria="Play">
          <Play className="size-4" fill="currentColor" />
        </PianoKey>
        <PianoKey label="Pause" down={paused} onClick={onPause} aria="Pause">
          <Pause className="size-4" fill="currentColor" />
        </PianoKey>
        <PianoKey label={isLast ? 'End' : 'FF'} onClick={onNext} aria={isLast ? 'Finish round' : 'Next song'}>
          <FastForward className="size-4" fill="currentColor" />
        </PianoKey>
      </div>
    </div>
  )
}

function PianoKey({ children, label, down, accent, onClick, aria }: { children: React.ReactNode; label: string; down?: boolean; accent?: boolean; onClick: () => void; aria: string }) {
  return (
    <button onClick={onClick} aria-label={aria} aria-pressed={down} className={cn('deck-key group grid cursor-pointer justify-items-center gap-1 rounded-b-[6px] pt-3 pb-2', down && 'deck-key-down')}>
      <span className={cn('text-[#e9e3da]', accent && 'text-[#f4a949]')}>{children}</span>
      <span className="font-mono text-[0.55rem] font-semibold tracking-[0.18em] text-[#a9a298] uppercase">{label}</span>
      {accent && <span className="absolute inset-x-3 top-1.5 h-[3px] rounded-full bg-[#f4a949]/80" />}
    </button>
  )
}

/** Two rows of LED segments (L/R) that bounce while the tape plays. */
function LevelMeters({ playing }: { playing: boolean }) {
  const [lv, setLv] = useState<[number, number]>([0, 0])
  useEffect(() => {
    if (!playing) {
      const t = window.setTimeout(() => setLv([0, 0]), 0)
      return () => window.clearTimeout(t)
    }
    const id = window.setInterval(() => {
      const base = 5 + Math.random() * 3
      setLv([Math.min(10, Math.round(base + Math.random() * 3)), Math.min(10, Math.round(base + Math.random() * 3 - 1))])
    }, 130)
    return () => window.clearInterval(id)
  }, [playing])
  return (
    <div className="ml-auto grid gap-1" aria-hidden>
      {(['L', 'R'] as const).map((ch, row) => (
        <div key={ch} className="flex items-center gap-[3px]">
          <span className="w-2 font-mono text-[0.5rem]">{ch}</span>
          {Array.from({ length: 10 }, (_, i) => {
            const on = i < lv[row]
            const color = i >= 8 ? '#ff3b3b' : i >= 6 ? '#f4a949' : '#9cc08a'
            return <span key={i} className="h-2 w-[0.55rem] rounded-[1px] transition-opacity duration-75" style={{ background: color, opacity: on ? 1 : 0.14, boxShadow: on ? `0 0 5px ${color}` : 'none' }} />
          })}
        </div>
      ))}
    </div>
  )
}
