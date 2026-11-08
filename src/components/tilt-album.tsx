import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/** Soft, bouncy springs: the "chill" feel. */
const SETTLE = { type: 'spring', stiffness: 120, damping: 11, mass: 0.9 } as const
const LIFT = { type: 'spring', stiffness: 260, damping: 16 } as const
const HOLD_MS = 180

/**
 * Anything you can pick up off the table. Press and hold to lift it, drag to turn it in 3D,
 * let go and it springs back with a gentle bounce. Flick it to spin; it settles on the front
 * or the back. Tap the back to flip it to the front again. `resetKey` change = back to the front.
 */
export function Tiltable({
  front,
  back,
  label,
  resetKey,
  floating,
  className,
  shapeClassName = 'aspect-square',
  radius = 'rounded-xl',
}: {
  front: React.ReactNode
  back: React.ReactNode
  label: string
  resetKey?: string
  floating?: boolean
  className?: string
  shapeClassName?: string
  radius?: string
}) {
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
  const shadow = useMotionTemplate`${shadowX}px ${shadowY}px 40px -16px rgb(0 0 0 / 0.75)`

  // New item: return to the front.
  useEffect(() => {
    animate(rotX, 0, SETTLE)
    animate(rotY, 0, SETTLE)
  }, [resetKey, rotX, rotY])

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
        aria-label={`${label}. Press and hold, then drag to turn it.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onContextMenu={(e) => e.preventDefault()}
        className={cn('relative w-full touch-none [transform-style:preserve-3d]', shapeClassName, held ? 'cursor-grabbing' : 'cursor-grab')}
        style={{ rotateX: rotX, rotateY: rotY, scale }}
      >
        <motion.div className={cn('absolute inset-0 overflow-hidden [backface-visibility:hidden]', radius)} style={{ boxShadow: shadow }}>
          {front}
          <motion.div className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ background: glare }} />
        </motion.div>
        <motion.div className={cn('absolute inset-0 overflow-hidden [backface-visibility:hidden] [transform:rotateY(180deg)]', radius)} style={{ boxShadow: shadow }}>
          {back}
          <motion.div className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ background: glare }} />
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

