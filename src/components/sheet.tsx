import { ChevronUp, X } from 'lucide-react'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * A sheet of paper tucked under the bottom edge of the screen. Its torn top edge peeks up
 * with a label and a one-line summary; tap it (or drag it up) to pull it into view, drag
 * it down or tap outside to tuck it away again. Holds a screen's secondary stuff so the
 * screen itself never has to scroll.
 */
export function PeekSheet({
  label,
  summary,
  icon,
  children,
  open: openProp,
  onOpenChange,
  className,
  badge,
}: {
  label: string
  summary?: React.ReactNode
  icon?: React.ReactNode
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  /** A small dot on the tab (something needs attention inside). */
  badge?: boolean
}) {
  const [own, setOwn] = useState(false)
  const open = openProp ?? own
  const setOpen = (v: boolean) => {
    setOwn(v)
    onOpenChange?.(v)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const tabDragEnd = (_: unknown, i: PanInfo) => {
    if (i.offset.y < -30 || i.velocity.y < -300) setOpen(true)
  }
  const sheetDragEnd = (_: unknown, i: PanInfo) => {
    if (i.offset.y > 90 || i.velocity.y > 500) setOpen(false)
  }

  return (
    <>
      {/* the tab peeking up from the bottom edge */}
      <motion.div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center"
        animate={{ y: open ? 80 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <motion.button
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.25, bottom: 0 }}
          onDragEnd={tabDragEnd}
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-label={`${label}: show`}
          className="pointer-events-auto w-full max-w-md cursor-pointer touch-none drop-shadow-[0_-2px_6px_rgb(0_0_0/0.45)]"
        >
          <div className="paper paper-texture torn-top grid bg-[var(--paper)] px-5 pt-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] text-left">
            <span className="mx-auto mb-1.5 block h-1 w-9 rounded-full bg-[#2a1e18]/20" />
            <span className="flex items-center gap-2.5">
              {icon && <span className="shrink-0 text-[#a0560b] [&_svg]:size-4">{icon}</span>}
              <span className="relative font-display text-base leading-none font-bold [font-stretch:80%]">
                {label}
                {badge && <span className="absolute -top-1 -right-2.5 size-2 rounded-full bg-neon" />}
              </span>
              {summary && <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{summary}</span>}
              <ChevronUp className="ml-auto size-4 shrink-0 text-muted-foreground" />
            </span>
          </div>
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-black/45"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-label={label}
              className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[84dvh] w-full max-w-md flex-col drop-shadow-[0_-4px_14px_rgb(0_0_0/0.5)]"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            >
              <div className={cn('paper paper-texture torn-top flex min-h-0 flex-col bg-[var(--paper)] pt-3', className)}>
                <motion.div
                  className="flex cursor-grab touch-none items-center gap-2.5 px-5 pt-1 pb-3 active:cursor-grabbing"
                  onPanEnd={sheetDragEnd}
                >
                  <span className="absolute top-3 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-[#2a1e18]/20" />
                  {icon && <span className="mt-2 shrink-0 text-[#a0560b] [&_svg]:size-4">{icon}</span>}
                  <h2 className="mt-2 text-xl leading-none font-bold font-soft">{label}</h2>
                  <button onClick={() => setOpen(false)} aria-label="Close" className="mt-1 ml-auto grid size-9 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted">
                    <X className="size-4" />
                  </button>
                </motion.div>
                <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">{children}</div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

/** Space at the bottom of a screen so the peeking sheet tab never covers content. */
export const PEEK_SPACE = 'pb-20'
