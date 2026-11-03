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
          toast: '!rounded-2xl !border-border !bg-card !text-card-foreground !shadow-lg !font-sans',
        },
      }}
      {...props}
    />
  )
}
