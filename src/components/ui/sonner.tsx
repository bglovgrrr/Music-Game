import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useTheme } from '@/hooks/use-theme'

export function Toaster(props: ToasterProps) {
  const { resolved } = useTheme()
  return (
    <Sonner
      position="top-center"
      theme={resolved}
      toastOptions={{
        classNames: {
          toast: 'paper paper-texture !rounded-[4px] !border-border !bg-card !text-card-foreground !shadow-lg !font-sans',
        },
      }}
      {...props}
    />
  )
}
