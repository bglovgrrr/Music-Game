import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] text-sm font-semibold tracking-[-0.005em] whitespace-nowrap transition-[transform,box-shadow,background-color,filter] duration-100 outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 cursor-pointer [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'key bg-primary text-primary-foreground hover:brightness-105',
        brand: 'key brand-gradient hover:brightness-105 [box-shadow:inset_0_-3px_0_rgb(0_0_0/0.22),inset_0_1px_0_rgb(255_255_255/0.35),0_2px_0_rgb(120_60_10/0.8),0_8px_26px_-6px_rgb(244_169_73/0.55)]',
        secondary: 'bg-secondary text-secondary-foreground hover:brightness-110 active:translate-y-px',
        outline: 'key border border-border bg-card text-card-foreground hover:brightness-110',
        ghost: 'hover:bg-muted active:translate-y-px',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-4 text-xs',
        lg: 'h-13 px-7 text-base',
        icon: 'size-11',
        'icon-sm': 'size-9',
        'icon-lg': 'size-16',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button'
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
