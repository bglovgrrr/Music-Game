import { cn } from '@/lib/utils'

/**
 * Physical things on the table. Each one is a styled wrapper; the look lives in index.css
 * (.index-card, .torn-*, .label-tape, .washi, .drop-on-table).
 */

/** A lined index card (red header rule, blue lines) with optional torn edges and a real drop shadow. */
export function IndexCard({
  children,
  className,
  innerClassName,
  torn = 'bottom',
  tilt = 0,
}: {
  children: React.ReactNode
  className?: string
  innerClassName?: string
  torn?: 'top' | 'bottom' | 'none'
  /** Degrees. Small values (±1.5) look natural. */
  tilt?: number
}) {
  return (
    <div className={cn('drop-on-table min-w-0', className)} style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}>
      <div className={cn('paper index-card rounded-[3px]', torn === 'bottom' && 'torn-bottom pb-4', torn === 'top' && 'torn-top pt-4', innerClassName)}>{children}</div>
    </div>
  )
}

/** Header line of an index card: sits above the red rule. */
export function IndexCardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex h-[2.75rem] items-end justify-between gap-2 px-4 pb-1.5', className)}>{children}</div>
}

/** Embossed label-maker tape (room codes, little labels). */
export function LabelTape({ children, className, tilt = -2 }: { children: React.ReactNode; className?: string; tilt?: number }) {
  return (
    <span
      className={cn('label-tape inline-flex items-center px-[0.6em] py-[0.15em] font-mono font-semibold tracking-[0.3em] uppercase', className)}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      {children}
    </span>
  )
}

/** A strip of masking tape, positioned by the parent (e.g. "absolute -top-3 left-1/2"). */
export function Washi({ className, tilt = -4 }: { className?: string; tilt?: number }) {
  return <span aria-hidden className={cn('washi pointer-events-none absolute block h-6 w-24', className)} style={{ transform: `rotate(${tilt}deg)` }} />
}

