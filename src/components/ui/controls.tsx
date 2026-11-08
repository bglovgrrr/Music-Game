import { cn } from '@/lib/utils'

export function Switch({
  checked,
  onChange,
  disabled,
  id,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  id: string
  label: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-default disabled:opacity-60',
        checked ? 'bg-accent' : 'bg-input',
      )}
    >
      <span className={cn('inline-block size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  )
}

export function Segmented<T extends string | number | null>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  disabled?: boolean
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-muted p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-8 cursor-pointer rounded-full px-3 text-xs font-semibold transition disabled:cursor-default',
            o.value === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
