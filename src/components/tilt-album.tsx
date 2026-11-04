import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { AlbumArt, Logo } from '@/components/game-ui'
import type { Track } from '@/game/types'
import { cn } from '@/lib/utils'

/** Soft, bouncy springs: the "chill" feel. */
const SETTLE = { type: 'spring', stiffness: 120, damping: 11, mass: 0.9 } as const
const LIFT = { type: 'spring', stiffness: 260, damping: 16 } as const
const HOLD_MS = 180

/**
 * The album sleeve. Press and hold to lift it, drag to turn it in 3D, let go and it
 * springs back with a gentle bounce. Flick it to spin; it settles on the front or on
 * the back (which reads "Side B"). Tap the back to flip it to the front again.
 */
export function TiltAlbum({ track, back, floating, className }: { track: Track; back?: React.ReactNode; floating?: boolean; className?: string }) {
  const reduce = useReducedMotion()
  const rotX = useMotionValue(0)
  const rotY = useMotionValue(0)
  const scale = useMotionValue(1)
  const [held, setHeld] = useState(false)
  const g = useRef<{ x: number; y: number; rx: number; ry: number; vx: number; lastX: number; lastT: number; timer?: number; id?: number; moved: boolean } | null>(null)

  // Light and shadow follow the turn.
  const glareX = useTransform(rotY, (v) => 50 + Math.sin((v * Math.PI) / 180) * 45)
  const glareY = useTransform(rotX, (v) => 50 - v * 1.2)
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgb(255 255 255 / 0.38), transparent 55%)`
  const shadowX = useTransform(rotY, (v) => -Math.sin((v * Math.PI) / 180) * 22)
  const shadowY = useTransform(rotX, (v) => 24 + v * 0.4)
  const shadow = useMotionTemplate`${shadowX}px ${shadowY}px 48px -18px rgb(40 30 80 / 0.5)`

  // New song: return to the front.
  useEffect(() => {
    animate(rotX, 0, SETTLE)
    animate(rotY, 0, SETTLE)
  }, [track.id, rotX, rotY])

  const settle = (velocity = 0) => {
    const projected = rotY.get() + (reduce ? 0 : velocity * 0.18)
    const face = Math.round(projected / 180) * 180
    animate(rotY, face, { ...SETTLE, velocity: reduce ? 0 : velocity })
    animate(rotX, 0, SETTLE)
    animate(scale, 1, LIFT)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const now = performance.now()
    g.current = { x: e.clientX, y: e.clientY, rx: rotX.get(), ry: rotY.get(), vx: 0, lastX: e.clientX, lastT: now, moved: false, id: e.pointerId }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    g.current.timer = window.setTimeout(() => {
      setHeld(true)
      animate(scale, 1.06, LIFT)
      try {
        navigator.vibrate?.(8)
      } catch {
        /* ignore */
      }
    }, HOLD_MS)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const s = g.current
    if (!s || s.id !== e.pointerId) return
    if (!held) {
      // Moving before the hold kicks in: also start turning (feels responsive on desktop).
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 6) return
      window.clearTimeout(s.timer)
      setHeld(true)
      animate(scale, 1.06, LIFT)
    }
    s.moved = true
    const now = performance.now()
    const dt = Math.max(1, now - s.lastT)
    s.vx = ((e.clientX - s.lastX) / dt) * 1000 * 0.55 // degrees per second
    s.lastX = e.clientX
    s.lastT = now
    rotY.set(s.ry + (e.clientX - s.x) * 0.55)
    rotX.set(Math.max(-38, Math.min(38, s.rx - (e.clientY - s.y) * 0.4)))
  }

  const end = (e: React.PointerEvent) => {
    const s = g.current
    if (!s || s.id !== e.pointerId) return
    window.clearTimeout(s.timer)
    const wasHeld = held
    g.current = null
    setHeld(false)
    if (!wasHeld && !s.moved) {
      // A plain tap: if we're showing the back, flip to the front.
      const turn = ((rotY.get() % 360) + 360) % 360
      if (turn > 90 && turn < 270) animate(rotY, rotY.get() + (turn < 180 ? -turn : 360 - turn), SETTLE)
      return
    }
    settle(performance.now() - s.lastT > 80 ? 0 : s.vx)
  }

  return (
    <motion.div
      className={cn('relative select-none [perspective:900px]', className)}
      animate={floating && !held && !reduce ? { y: [0, -6, 0] } : { y: 0 }}
      transition={floating && !held && !reduce ? { duration: 5, repeat: Infinity, ease: 'easeInOut' } : SETTLE}
    >
      <motion.div
        role="img"
        aria-label={`${track.title} by ${track.artist}. Press and hold, then drag to turn the album.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onContextMenu={(e) => e.preventDefault()}
        className={cn('relative aspect-square w-full touch-none [transform-style:preserve-3d]', held ? 'cursor-grabbing' : 'cursor-grab')}
        style={{ rotateX: rotX, rotateY: rotY, scale }}
      >
        {/* Front */}
        <motion.div className="absolute inset-0 overflow-hidden rounded-xl [backface-visibility:hidden]" style={{ boxShadow: shadow }}>
          <AlbumArt track={track} className="size-full" rounded="rounded-xl" />
          <motion.div className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ background: glare }} />
        </motion.div>
        {/* Back: Side B */}
        <motion.div
          className="absolute inset-0 overflow-hidden rounded-xl [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{ boxShadow: shadow }}
        >
          <div className="brand-gradient flex size-full flex-col justify-between p-[9%] text-ink">
            <Logo className="[&>span:first-child]:size-6 [&>span:last-child]:text-base" />
            <div className="grid gap-1 text-left">
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase opacity-60">Now playing</span>
              <span className="font-display text-2xl leading-tight font-medium italic font-soft">{track.title}</span>
              <span className="text-sm opacity-70">{track.artist}</span>
              {back}
            </div>
          </div>
          <motion.div className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ background: glare }} />
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
