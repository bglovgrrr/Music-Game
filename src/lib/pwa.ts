import { registerSW } from 'virtual:pwa-register'
import { toast } from 'sonner'

/** True while a demo game is running (reloading would lose it). Set by App. */
let demoActive = false
export const setDemoActive = (v: boolean) => {
  demoActive = v
}

/**
 * Keeps the installed app up to date. Checks for a new version on start and whenever
 * the app comes back to the foreground; applies it right away unless a demo game is
 * running (online games survive a reload), in which case it offers a button.
 */
export function setupPwa() {
  if (import.meta.env.MODE === 'preview' || !('serviceWorker' in navigator)) return
  let offered = false
  const update = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (!demoActive) {
        void update(true)
        return
      }
      if (offered) return
      offered = true
      toast('A new version of Mixtape Memories is ready', {
        duration: Infinity,
        action: { label: 'Update', onClick: () => void update(true) },
      })
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => void registration.update().catch(() => {})
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
      setInterval(check, 30 * 60 * 1000)
    },
  })
}
