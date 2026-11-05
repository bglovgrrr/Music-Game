import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'

/** One tap flips light <-> dark. Until you tap it, the app matches your device. */
export function ThemeToggle() {
  const { resolved, setTheme } = useTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'
  const Icon = resolved === 'dark' ? Moon : Sun
  return (
    <Button variant="ghost" size="icon-sm" aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`} onClick={() => setTheme(next)}>
      <Icon />
    </Button>
  )
}
