import * as React from 'react'
import { cn } from '@/lib/utils'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn('rounded-2xl border bg-card text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.03),0_8px_24px_-16px_rgb(60_50_120/0.18)]', className)}
      {...props}
    />
  )
}

export { Card }
