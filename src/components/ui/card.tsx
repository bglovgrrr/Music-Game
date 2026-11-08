import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Something lying on the table. `paper` (default): cream card stock. `dark`: a black
 * card / cassette case. Paper re-scopes the colour tokens, so children just use the usual classes.
 */
function Card({ className, material = 'paper', ...props }: React.ComponentProps<'div'> & { material?: 'paper' | 'dark' }) {
  return (
    <div
      data-slot="card"
      className={cn('on-table rounded-[6px] bg-card text-card-foreground', material === 'paper' ? 'paper paper-texture' : 'border border-white/10', className)}
      {...props}
    />
  )
}

export { Card }
