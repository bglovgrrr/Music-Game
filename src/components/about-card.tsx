import { Headphones, Info, MessageCircleQuestion, Music2, X } from 'lucide-react'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

const STEPS = [
  { icon: MessageCircleQuestion, title: 'Ask', text: 'Someone asks the group a question.', tint: 'var(--pastel-1)' },
  { icon: Music2, title: 'Pick', text: 'Everyone secretly answers with a song.', tint: 'var(--pastel-2)' },
  { icon: Headphones, title: 'Listen & talk', text: 'Play each one and tell the story behind it.', tint: 'var(--pastel-4)' },
]

/** How far (px) or how fast (px/s) a swipe has to go to throw the card away. */
const THROW = { distance: 110, speed: 600 }

/**
 * Info button that opens the "Every song has a story" card. The card can be dragged around,
 * wobbles while you hold it, and goes away when you swipe it off or tap the X.
 */
export function AboutButton() {
  const [open, setOpen] = useState(false)
  const [exitTo, setExitTo] = useState({ x: 0, y: -24, rotate: 0 })

  const close = (to = { x: 0, y: -24, rotate: 0 }) => {
    setExitTo(to)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const onDragEnd = (_: unknown, { offset, velocity }: PanInfo) => {
    const far = Math.hypot(offset.x, offset.y) > THROW.distance
    const fast = Math.hypot(velocity.x, velocity.y) > THROW.speed
    if (!far && !fast) return // springs back
    // Keep flying the way it was thrown.
    const dx = offset.x + velocity.x * 0.35
    const dy = offset.y + velocity.y * 0.35
    const len = Math.hypot(dx, dy) || 1
    close({ x: (dx / len) * 700, y: (dy / len) * 700, rotate: Math.sign(dx || 1) * 25 })
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label="About Side B" title="About Side B" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
        <Info />
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => close()}
          />
        )}
        {open && (
          <motion.div
            key="card"
            role="dialog"
            aria-modal="true"
            aria-label="About Side B"
            className="fixed inset-x-4 top-[max(4.5rem,calc(env(safe-area-inset-top)+4rem))] z-50 mx-auto max-w-sm cursor-grab touch-none rounded-[1.6rem] border bg-card p-6 text-card-foreground shadow-[0_24px_48px_-16px_rgb(40_30_80/0.4)] select-none active:cursor-grabbing"
            initial={{ opacity: 0, y: -24, scale: 0.92, rotate: -2 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.9, ...exitTo, transition: { duration: 0.35, ease: 'easeIn' } }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            drag
            dragSnapToOrigin
            dragElastic={0.6}
            dragTransition={{ bounceStiffness: 300, bounceDamping: 14 }}
            onDragEnd={onDragEnd}
            // Wobbles gently while held
            whileTap={{ scale: 1.03, rotate: [0, -2.5, 2.5, -1.5, 1.5, 0], transition: { rotate: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' } } }}
            whileDrag={{ scale: 1.04 }}
          >
            <button
              onClick={() => close()}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Close"
              className="absolute top-3 right-3 grid size-9 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>

            <h2 className="pr-8 text-[2.5rem] leading-[1] font-medium font-soft">
              Every song
              <br />
              has a <em className="brand-text pr-1 font-medium">story.</em>
            </h2>
            <p className="mt-3 text-muted-foreground">
              A slow, cozy music game for friends. Answer a question with a song, then listen together and talk about why you picked it.
            </p>

            <ol className="mt-5 grid gap-3.5">
              {STEPS.map(({ icon: Icon, title, text, tint }, i) => (
                <motion.li
                  key={title}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12 + i * 0.08 }}
                  className="flex items-center gap-3"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full text-ink" style={{ background: tint }}>
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="grid">
                    <span className="font-semibold">{title}</span>
                    <span className="text-sm text-muted-foreground">{text}</span>
                  </span>
                </motion.li>
              ))}
            </ol>
            <p className="mt-5 text-center text-xs text-muted-foreground">Swipe away or tap ✕ to close</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
