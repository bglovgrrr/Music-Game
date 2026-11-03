import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { type ThemeChoice, useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Match device', icon: Monitor },
]

/** Sun/moon button showing the current look; opens Light / Dark / Match device. */
export function ThemeToggle() {
  const { choice, resolved, setTheme } = useTheme()
  const Icon = resolved === 'dark' ? Moon : Sun

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Change theme" title="Theme">
          <Icon />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-44 rounded-2xl border bg-card p-1.5 text-card-foreground shadow-[0_12px_32px_-12px_rgb(40_30_80/0.35)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DropdownMenu.Label className="px-3 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">Theme</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={choice} onValueChange={(v) => setTheme(v as ThemeChoice)}>
            {OPTIONS.map(({ value, label, icon: ItemIcon }) => (
              <DropdownMenu.RadioItem
                key={value}
                value={value}
                className={cn(
                  'flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none select-none',
                  'data-[highlighted]:bg-muted data-[state=checked]:text-foreground',
                )}
              >
                <ItemIcon className="size-4 text-muted-foreground" />
                <span className="flex-1">{label}</span>
                <DropdownMenu.ItemIndicator>
                  <Check className="size-4 text-accent" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
