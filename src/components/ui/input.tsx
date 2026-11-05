import * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'paper h-12 w-full min-w-0 rounded-lg border border-input bg-card shadow-[inset_0_1px_3px_rgb(0_0_0/0.12)] px-4 text-base  transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'paper min-h-24 w-full rounded-lg border border-input bg-card shadow-[inset_0_1px_3px_rgb(0_0_0/0.12)] px-4 py-3 text-base  outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 resize-none',
        className,
      )}
      {...props}
    />
  )
}

export { Input, Textarea }
