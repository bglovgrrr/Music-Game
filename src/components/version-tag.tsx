import { cn } from '@/lib/utils'

/** "v1.0.0 · 1063ce6": which release this phone is running (tap/hover shows when it was built). */
export function VersionTag({ className }: { className?: string }) {
  const built = new Date(__APP_BUILT__)
  const when = Number.isNaN(built.getTime()) ? '' : built.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return (
    <span
      className={cn('font-mono text-[0.6rem] tracking-[0.04em] whitespace-nowrap text-muted-foreground/80 select-text', className)}
      title={when ? `Built ${when}` : undefined}
    >
      v{__APP_VERSION__} · {__APP_COMMIT__}
    </span>
  )
}
